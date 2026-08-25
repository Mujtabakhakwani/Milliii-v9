import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { KeyRound, Lock, ArrowLeft, Sparkles, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';

const VerifyOTP = () => {
  const location = useLocation();
  const email = location.state?.email;
  
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState('otp'); // 'otp' or 'password'
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect if no email provided
  if (!email) {
    navigate('/forgot-password');
    return null;
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (otp.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/verify-otp`, {
        email: email,
        otp: otp
      });

      if (response.data.verified) {
        toast.success('OTP verified! Please enter your new password.');
        setStep('password');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/reset-password-otp`, {
        email: email,
        otp: otp,
        new_password: newPassword
      });

      toast.success(response.data.message);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, {
        email: email
      });
      toast.success('New OTP has been sent to your email');
    } catch (err) {
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/50">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Millii</h1>
        </div>

        <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center text-white">
              {step === 'otp' ? 'Enter OTP' : 'Reset Password'}
            </CardTitle>
            <CardDescription className="text-center text-gray-400">
              {step === 'otp' 
                ? `We've sent a 6-digit OTP to ${email}` 
                : 'Enter your new password below'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'otp' ? (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-gray-300">Enter 6-Digit OTP</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="otp"
                      name="otp"
                      type="text"
                      maxLength={6}
                      pattern="[0-9]{6}"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="pl-10 bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-indigo-500 text-center text-2xl tracking-widest font-mono"
                      placeholder="000000"
                      autoComplete="off"
                    />
                  </div>
                  <p className="text-xs text-gray-400">OTP expires in 10 minutes</p>
                </div>

                <Button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold shadow-lg shadow-indigo-500/50"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="inline-flex items-center text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Didn't receive OTP? Resend
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-gray-300">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-indigo-500"
                      placeholder="Enter new password (min 6 characters)"
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-300">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-indigo-500"
                      placeholder="Confirm new password"
                      minLength={6}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold shadow-lg shadow-indigo-500/50"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyOTP;
