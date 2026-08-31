'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import { ProducerVerificationDetails } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ShieldAlert, CheckCircle, XCircle, FileText, User } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function AdminProducerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const verificationId = params.id as string;

  const [producer, setProducer] = useState<ProducerVerificationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suspension state
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);

  // Approve/Reject state
  const [isActioning, setIsActioning] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchProducer = useCallback(async () => {
    try {
      
      const res = await adminApi.getVerificationById(verificationId);
      if (res.success && res.data) {
        setProducer(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load producer details');
    } finally {
      setIsLoading(false);
    }
  }, [verificationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducer();
  }, [fetchProducer]);

  const handleApprove = async () => {
    try {
      setIsActioning(true);
      const res = await adminApi.approveProducer(verificationId);
      if (res.success) {
        fetchProducer();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve producer');
    } finally {
      setIsActioning(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      setIsActioning(true);
      const res = await adminApi.rejectProducer(verificationId, rejectReason);
      if (res.success) {
        setIsRejectModalOpen(false);
        fetchProducer();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reject producer');
    } finally {
      setIsActioning(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim() || !producer) return;
    try {
      setIsSuspending(true);
      // The API endpoint for suspend uses the producerId, not verificationId.
      const res = await adminApi.suspendProducer(producer.producerId, suspendReason);
      if (res.success) {
        setIsSuspendModalOpen(false);
        fetchProducer(); // Refresh data to show suspended status
      }
    } catch (err: any) {
      alert(err.message || 'Failed to suspend producer');
    } finally {
      setIsSuspending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !producer) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg text-center max-w-2xl mx-auto mt-10">
        <h3 className="text-lg font-medium">Error Loading Producer</h3>
        <p className="mt-1">{error || 'Producer not found'}</p>
        <Link href="/admin/producers">
          <Button variant="outline" className="mt-4 bg-white">Back to Producers</Button>
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"><CheckCircle className="w-4 h-4 mr-1.5" /> Approved</span>;
      case 'PENDING':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800"><FileText className="w-4 h-4 mr-1.5" /> Pending</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800"><XCircle className="w-4 h-4 mr-1.5" /> Rejected</span>;
      case 'SUSPENDED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800"><ShieldAlert className="w-4 h-4 mr-1.5" /> Suspended</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/producers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              {producer.producer?.farmName || 'Unknown Farm'}
              {getStatusBadge(producer.status)}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Verification ID: {producer.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {producer.status === 'PENDING' && (
            <>
              <Button 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setIsRejectModalOpen(true)}
                disabled={isActioning}
              >
                Reject
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={isActioning}
              >
                {isActioning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Approve
              </Button>
            </>
          )}
          {producer.status === 'APPROVED' && (
            <Button 
              variant="destructive"
              onClick={() => setIsSuspendModalOpen(true)}
            >
              <ShieldAlert className="w-4 h-4 mr-2" />
              Suspend Producer
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col - Producer Info */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-slate-500" /> Business Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Farm / Business Name</dt>
                  <dd className="mt-1 text-sm text-slate-900">{producer.producer?.farmName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Business Address</dt>
                  <dd className="mt-1 text-sm text-slate-900">{(producer.producer as any)?.businessAddress}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">GSTIN / Tax ID</dt>
                  <dd className="mt-1 text-sm text-slate-900 font-mono bg-slate-100 px-2 py-1 rounded inline-block">
                    {(producer.producer as any)?.gstin || 'Not Provided'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Certifications</dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {(producer.producer as any)?.certifications && (producer.producer as any).certifications.length > 0 
                      ? (producer.producer as any).certifications.join(', ') 
                      : 'None'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-slate-500">Submitted Documents</dt>
                  <dd className="mt-2 text-sm text-slate-900">
                    <pre className="bg-slate-900 text-slate-300 p-4 rounded-md overflow-x-auto text-xs">
                      {JSON.stringify(producer.documents, null, 2)}
                    </pre>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {producer.rejectionReason && (
             <Card className="border-red-200">
              <CardHeader className="border-b bg-red-50/50 border-red-100">
                <CardTitle className="text-lg text-red-800 flex items-center gap-2">
                  <XCircle className="w-5 h-5" /> Rejection / Suspension Reason
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-slate-700 whitespace-pre-wrap">{producer.rejectionReason}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Col - Meta info */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <div className="text-xs text-slate-500 font-medium">Submitted At</div>
                <div className="text-sm text-slate-900 mt-1">{new Date(producer.submittedAt).toLocaleString()}</div>
              </div>
              {producer.reviewedAt && (
                <div>
                  <div className="text-xs text-slate-500 font-medium">Reviewed At</div>
                  <div className="text-sm text-slate-900 mt-1">{new Date(producer.reviewedAt).toLocaleString()}</div>
                </div>
              )}
              {producer.reviewedBy && (
                <div>
                  <div className="text-xs text-slate-500 font-medium">Reviewed By</div>
                  <div className="text-sm text-slate-900 mt-1">{producer.reviewedBy.name}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Suspend Modal */}
      <Dialog open={isSuspendModalOpen} onOpenChange={setIsSuspendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Suspend Producer
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to suspend this producer? Their products will be hidden and they will not be able to process new orders. This action is logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">Reason for suspension (Required)</label>
              <Textarea 
                placeholder="e.g. Violation of terms, fraudulent activity..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSuspendModalOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleSuspend}
              disabled={isSuspending || !suspendReason.trim()}
            >
              {isSuspending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Suspension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Reject Verification
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this producer&apos;s verification. They will see this reason in their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">Rejection Reason (Required)</label>
              <Textarea 
                placeholder="e.g. Invalid GSTIN, incomplete address..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={isActioning || !rejectReason.trim()}
            >
              {isActioning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
