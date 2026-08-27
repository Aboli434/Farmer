'use client';

import { useAuth } from '@/lib/auth/store';
import { AddressManager } from '@/components/customer/AddressManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Phone, LogOut, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
        <p className="text-gray-500 mt-1">Manage your profile, addresses, and settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Profile Info */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="bg-gray-50 border-b pb-4 pt-5">
              <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                <User className="h-5 w-5 text-green-600" />
                Personal Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Full Name</p>
                <p className="font-medium text-gray-900">{user?.name || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone Number</p>
                <p className="font-medium text-gray-900">{user?.phone}</p>
              </div>
              
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md font-medium">
                  <Shield className="h-4 w-4" />
                  Verified Customer Account
                </div>
              </div>
            </CardContent>
          </Card>

          <Button 
            variant="outline" 
            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-12"
            onClick={() => logout()}
          >
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </Button>
        </div>

        {/* Addresses */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="bg-gray-50 border-b pb-4 pt-5">
              <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                Saved Addresses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <AddressManager />
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
