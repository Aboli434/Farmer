'use client';

import { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { reviewsApi } from '@/lib/api/reviews';
import { ApiClientError } from '@/lib/api/client';
import { Review } from '@/types/review';

interface ReviewFormProps {
  orderItemId: string;
  existingReview?: Review;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReviewForm({ orderItemId, existingReview, onSuccess, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      if (existingReview) {
        await reviewsApi.updateReview(existingReview.id, { rating, comment });
      } else {
        await reviewsApi.createReview({ orderItemId, rating, comment });
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to submit review');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="focus:outline-none"
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setRating(star)}
            >
              <Star
                className={`h-8 w-8 transition-colors ${
                  star <= (hoveredRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Review Comment (Optional)
        </label>
        <Textarea
          rows={4}
          value={comment}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
          placeholder="What did you like or dislike?"
          maxLength={500}
        />
        <p className="text-xs text-gray-500 mt-1 text-right">
          {comment.length} / 500
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || rating === 0} className="bg-green-600 hover:bg-green-700">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {existingReview ? 'Update Review' : 'Submit Review'}
        </Button>
      </div>
    </form>
  );
}
