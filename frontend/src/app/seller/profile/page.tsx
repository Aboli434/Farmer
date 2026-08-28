'use client';

import { useEffect, useState, useCallback } from 'react';
import { sellerApi } from '@/lib/api/seller';
import { ProducerProfile } from '@/types/seller';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Store, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function SellerProfilePage() {
  const [profile, setProfile] = useState<ProducerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await sellerApi.getProducerProfile();
      if (res.success && res.data) {
        setProfile(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const isSuspended = false; // Logic handled in layout or via verifications in a real app

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border border-red-200">
        <h2 className="text-lg font-semibold text-red-600">Error</h2>
        <p className="text-gray-600">{error || 'Could not load profile'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Producer Profile</h1>
        <p className="text-sm text-gray-500">Manage your farm details and verification status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Verification & Trust */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4 bg-gray-50 rounded-lg border">
                {isSuspended ? (
                  <>
                    <ShieldAlert className="h-10 w-10 text-red-500 mb-2" />
                    <h3 className="font-semibold text-red-700">Suspended</h3>
                    <p className="text-xs text-red-600 mt-1 text-center px-4">Contact support to resolve issues.</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                    <h3 className="font-semibold text-green-700">Verified Producer</h3>
                    <p className="text-xs text-gray-500 mt-1">Your account is active.</p>
                  </>
                )}
              </div>

              <div className="text-sm space-y-2 pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-gray-500">Producer Type</span>
                  <span className="font-medium text-gray-900">{profile.producerType.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Joined</span>
                  <span className="font-medium text-gray-900">{new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Profile Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Store className="h-5 w-5 mr-2 text-gray-400" />
                Farm Details
              </CardTitle>
              <CardDescription>
                Basic information about your farm/business.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Farm / Business Name</label>
                <Input value={profile.farmName} readOnly className="bg-gray-50" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Your Story</label>
                <Textarea value={profile.story} readOnly className="bg-gray-50" rows={4} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">FSSAI Number (Optional)</label>
                <Input value={profile.fssaiNumber || 'Not provided'} readOnly className="bg-gray-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-gray-400" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">City</label>
                  <Input value={profile.city} readOnly className="bg-gray-50" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">District</label>
                  <Input value={profile.district} readOnly className="bg-gray-50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">State</label>
                  <Input value={profile.state} readOnly className="bg-gray-50" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Pincode</label>
                  <Input value={profile.pincode} readOnly className="bg-gray-50" />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Service Radius (km)</label>
                <Input value={profile.serviceRadius} readOnly className="bg-gray-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
