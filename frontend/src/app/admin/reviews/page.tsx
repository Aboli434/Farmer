'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import { ReviewModerationItem } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Star, EyeOff, Eye, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewModerationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Moderation state
  const [selectedReview, setSelectedReview] = useState<ReviewModerationItem | null>(null);
  const [isHideModalOpen, setIsHideModalOpen] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  const fetchReviews = useCallback(async (currentPage: number) => {
    try {
      setIsLoading(true);
      const res = await adminApi.getModerationQueue({ page: currentPage, limit: 20 });
      if (res.success && res.data) {
        setReviews(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.pages);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews(page);
  }, [fetchReviews, page]);

  const handleModerate = async (reviewId: string, status: 'VISIBLE' | 'HIDDEN') => {
    try {
      setIsActioning(true);
      const res = await adminApi.moderateReview(reviewId, status);
      if (res.success) {
        setIsHideModalOpen(false);
        setSelectedReview(null);
        fetchReviews(page);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to moderate review');
    } finally {
      setIsActioning(false);
    }
  };

  const openHideModal = (review: ReviewModerationItem) => {
    setSelectedReview(review);
    setIsHideModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Review Moderation</h1>
          <p className="text-sm text-slate-500">Manage reported and flagged reviews across the marketplace.</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <CardTitle className="text-lg">Moderation Queue</CardTitle>
          <CardDescription>Reviews flagged by users or automated systems appear here first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && reviews.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600 bg-red-50 flex flex-col items-center">
              <AlertTriangle className="h-8 w-8 mb-2" />
              {error}
              <Button onClick={() => fetchReviews(page)} variant="outline" className="mt-4 bg-white">Retry</Button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
                <Star className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No flagged reviews</h3>
              <p className="mt-1 text-sm">The moderation queue is currently empty.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3">User & Product</th>
                    <th className="px-6 py-3">Rating</th>
                    <th className="px-6 py-3 w-1/2">Comment</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reviews.map((review) => (
                    <tr key={review.id} className={`bg-white hover:bg-slate-50 transition-colors ${review.status === 'FLAGGED' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{review.user?.name || 'Unknown User'}</div>
                        <div className="text-xs text-slate-500">For: {review.product?.name || 'Unknown Product'}</div>
                        <div className="text-xs text-slate-400 mt-1">{new Date(review.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              className={`w-3 h-3 ${star <= review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {review.status === 'FLAGGED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 mb-1 uppercase tracking-wider">
                            Flagged
                          </span>
                        )}
                        <p className="text-slate-700 whitespace-pre-wrap">{review.comment || '(No comment)'}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-slate-600"
                            onClick={() => handleModerate(review.id, 'VISIBLE')}
                            disabled={isActioning || review.status === 'VISIBLE'}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Keep Visible
                          </Button>
                          <Button 
                            variant="outline"
                            size="sm" 
                            className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => openHideModal(review)}
                            disabled={isActioning || review.status === 'HIDDEN'}
                          >
                            <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                            Hide
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50">
              <div className="text-sm text-slate-500">
                Page <span className="font-medium text-slate-900">{page}</span> of <span className="font-medium text-slate-900">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hide Modal */}
      <Dialog open={isHideModalOpen} onOpenChange={setIsHideModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <EyeOff className="w-5 h-5" /> Hide Review
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to hide this review? It will no longer be visible to customers on the product page.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedReview && (
              <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                <div className="flex items-center mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      className={`w-3 h-3 ${star <= selectedReview.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                    />
                  ))}
                </div>
                <p className="text-sm text-slate-700 italic">"{selectedReview.comment}"</p>
                <div className="text-xs text-slate-500 mt-2">— {selectedReview.user?.name}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHideModalOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedReview && handleModerate(selectedReview.id, 'HIDDEN')}
              disabled={isActioning}
            >
              {isActioning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Hide Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
