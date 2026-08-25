import React from 'react';
import { FixedSizeList as List } from 'react-window';

/**
 * VirtualList - High-performance list component
 * Only renders visible items, dramatically improves performance for large lists
 * 
 * Usage:
 * <VirtualList
 *   items={tasks}
 *   height={600}
 *   itemHeight={80}
 *   renderItem={({ item, index, style }) => (
 *     <div style={style} key={item.id}>
 *       <TaskCard task={item} />
 *     </div>
 *   )}
 * />
 */

const VirtualList = ({
  items = [],
  height = 600,
  itemHeight = 80,
  renderItem,
  className = '',
  width = '100%'
}) => {
  // If no items, show empty state
  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-muted-foreground">No items to display</p>
      </div>
    );
  }

  // Row renderer for react-window
  const Row = ({ index, style }) => {
    const item = items[index];
    return renderItem({ item, index, style });
  };

  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      width={width}
      className={className}
    >
      {Row}
    </List>
  );
};

export default React.memo(VirtualList);
