'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { authApi } from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/store';
import { ApiClientError } from '@/lib/api/client';

const phoneSchema = z.object({
  phone: z.string().regex(/^[0-9]{10}$/, 'Enter a valid 10-digit phone number'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  name: z.string().optional(),
});

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('');
  const [showNameField, setShowNameField] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const onPhoneSubmit = async (values: z.infer<typeof phoneSchema>) => {
    setErrorMsg(null);
    setIsLoading(true);
    
    try {
      const formattedPhone = values.phone; // Backend expects 10 digits
      const res = await authApi.sendOtp(formattedPhone);
      setPhone(formattedPhone);
      
      if (res.data?.isNewUser) {
        setShowNameField(true);
      }
      
      setStep('OTP');
      setResendCooldown(30);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Failed to send OTP. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onOtpSubmit = async (values: z.infer<typeof otpSchema>) => {
    setErrorMsg(null);
    setIsLoading(true);
    
    try {
      const res = await authApi.verifyOtp(phone, values.otp, values.name);
      
      if (!res.data) {
        throw new Error('Invalid response');
      }

      // Update auth store
      login(res.data.user);
      
      // Redirect based on role
      const role = res.data.user.role;
      if (role === 'CUSTOMER') {
        router.push('/customer');
      } else if (role === 'SELLER') {
        router.push('/seller');
      } else if (role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.code === 'NAME_REQUIRED') {
          setShowNameField(true);
          setErrorMsg('Welcome! Please enter your full name to complete registration.');
          return;
        }
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Invalid OTP. Please try again.');
      }
      otpForm.reset({ ...values, otp: '' }); // reset OTP but keep name if any
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMsg(null);
    if (resendCooldown > 0 || isLoading) return;
    
    setIsLoading(true);
    try {
      await authApi.sendOtp(phone);
      setResendCooldown(30);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Failed to resend OTP.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-green-700">Farmer Marketplace</CardTitle>
          <CardDescription>
            {step === 'PHONE' ? 'Sign in to your account' : `Enter the 6-digit OTP sent to ${phone}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          {step === 'PHONE' && (
            <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Phone Number
                </label>
                <div className="flex rounded-md shadow-sm">
                  <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm">
                    +91
                  </span>
                  <Input
                    type="tel"
                    placeholder="XXXXXXXXXX"
                    className="rounded-l-none"
                    {...phoneForm.register('phone')}
                    disabled={isLoading}
                  />
                </div>
                {phoneForm.formState.errors.phone && (
                  <p className="text-[0.8rem] font-medium text-destructive">
                    {phoneForm.formState.errors.phone.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send OTP
              </Button>
            </form>
          )}

          {step === 'OTP' && (
            <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
              {showNameField && (
                <div className="space-y-2 mb-4">
                  <label className="text-sm font-medium leading-none">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    {...otpForm.register('name')}
                    disabled={isLoading}
                  />
                </div>
              )}
              <div className="flex flex-col items-center space-y-2">
                <InputOTP
                  maxLength={6}
                  value={otpForm.watch('otp')}
                  onChange={(val) => otpForm.setValue('otp', val)}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                {otpForm.formState.errors.otp && (
                  <p className="text-[0.8rem] font-medium text-destructive">
                    {otpForm.formState.errors.otp.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify OTP
              </Button>
              <div className="text-center text-sm">
                {resendCooldown > 0 ? (
                  <span className="text-gray-500">Resend OTP in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-green-600 hover:underline disabled:opacity-50"
                    disabled={isLoading}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => { 
                    setStep('PHONE'); 
                    otpForm.reset(); 
                    setErrorMsg(null); 
                    setShowNameField(false);
                  }}
                  className="text-sm text-gray-500 hover:underline"
                  disabled={isLoading}
                >
                  Change Phone Number
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
