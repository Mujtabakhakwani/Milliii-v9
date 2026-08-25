import React, { useState, useEffect, useRef } from 'react';

/**
 * LazyImage - Progressive image loading component
 * 
 * Features:
 * - Lazy loading (loads when in viewport)
 * - Progressive loading (blur-up effect)
 * - Fallback support
 * - Intersection Observer API
 * 
 * Usage:
 * <LazyImage
 *   src="/path/to/image.jpg"
 *   alt="Description"
 *   placeholder="/path/to/placeholder.jpg"
 *   className="w-full h-auto"
 * />
 */

const LazyImage = ({
  src,
  alt = '',
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==',
  className = '',
  style = {},
  onLoad = null,
  onError = null,
  threshold = 0.1,
  rootMargin = '50px'
}) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [imageRef, setImageRef] = useState();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Setup Intersection Observer
  useEffect(() => {
    if (!imageRef) return;
    
    // Check if browser supports Intersection Observer
    if (!('IntersectionObserver' in window)) {
      // Fallback: load immediately
      setImageSrc(src);
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Image is in viewport, start loading
            setImageSrc(src);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );
    
    observer.observe(imageRef);
    
    return () => {
      if (imageRef) {
        observer.unobserve(imageRef);
      }
    };
  }, [imageRef, src, threshold, rootMargin]);
  
  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  };
  
  // Handle image error
  const handleError = () => {
    setHasError(true);
    if (onError) onError();
  };
  
  return (
    <div className={`relative ${className}`} style={style}>
      <img
        ref={setImageRef}
        src={imageSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={`
          w-full h-full
          transition-opacity duration-500
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
          ${hasError ? 'hidden' : ''}
        `}
        loading="lazy"
      />
      
      {/* Loading placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      )}
      
      {/* Error fallback */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Image failed to load</p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * LazyBackground - Lazy loading for background images
 */
export const LazyBackground = ({
  src,
  children,
  className = '',
  style = {},
  placeholder = '#f0f0f0'
}) => {
  const [bgImage, setBgImage] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const divRef = useRef();
  
  useEffect(() => {
    if (!divRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Preload image
            const img = new Image();
            img.src = src;
            img.onload = () => {
              setBgImage(`url(${src})`);
              setIsLoaded(true);
            };
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );
    
    observer.observe(divRef.current);
    
    return () => {
      if (divRef.current) {
        observer.unobserve(divRef.current);
      }
    };
  }, [src]);
  
  return (
    <div
      ref={divRef}
      className={`${className} transition-all duration-500`}
      style={{
        ...style,
        backgroundImage: bgImage || 'none',
        backgroundColor: placeholder,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: isLoaded ? 'blur(0)' : 'blur(10px)'
      }}
    >
      {children}
    </div>
  );
};

export default React.memo(LazyImage);
