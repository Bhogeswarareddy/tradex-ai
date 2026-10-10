import React, { useState } from "react";
import { Star, MessageSquare, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { SupplierReviewItem, suppliersApi } from "../../lib/api/suppliers";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

interface SupplierReviewsTabProps {
  supplierId: string;
  reviews: SupplierReviewItem[];
  averageRating: number;
  totalReviews: number;
  onReviewSubmitted?: (newReview: SupplierReviewItem) => void;
}

export const SupplierReviewsTab: React.FC<SupplierReviewsTabProps> = ({
  supplierId,
  reviews,
  averageRating,
  totalReviews,
  onReviewSubmitted,
}) => {
  const [ratingInput, setRatingInput] = useState(5);
  const [titleInput, setTitleInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reviewList, setReviewList] = useState<SupplierReviewItem[]>(reviews);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) {
      setErrorMsg("Please enter a review summary title.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await suppliersApi.postReview(supplierId, {
        rating: ratingInput,
        title: titleInput.trim(),
        comment: commentInput.trim() || undefined,
      });
      setSuccessMsg("Review successfully verified and posted!");
      setReviewList([res.review, ...reviewList]);
      setTitleInput("");
      setCommentInput("");
      if (onReviewSubmitted) onReviewSubmitted(res.review);
    } catch (err: any) {
      setErrorMsg(
        err.message || "Only buyers with a completed order can post a review."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Rating Summary Card */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-amber-600 leading-none">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Out of 5</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(averageRating)
                      ? "fill-amber-400 text-amber-500"
                      : "text-slate-200"
                  }`}
                />
              ))}
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              Verified Order Reviews ({totalReviews})
            </h4>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              100% verified buyer escrow transaction reviews
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Reviews List */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            Verified Buyer Feedback
          </h3>

          {reviewList.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
              No reviews recorded for this supplier yet.
            </div>
          ) : (
            <div className="space-y-3">
              {reviewList.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-1">{rev.title}</h4>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                      {rev.created_at}
                    </span>
                  </div>

                  {rev.comment && (
                    <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-bold text-slate-800">{rev.buyer_name}</span>
                    <span>•</span>
                    <span title="Verified Order" className="ml-auto">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Write a Review Form */}
        <div className="lg:col-span-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              Write a Review
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Reviews can only be submitted by buyers with a confirmed or completed order with this supplier.
            </p>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingInput(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= ratingInput
                            ? "fill-amber-400 text-amber-500"
                            : "text-slate-200"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-700 ml-2">
                    {ratingInput} of 5 Stars
                  </span>
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Review Summary</label>
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="e.g. Excellent quality and punctual shipment"
                  className="text-xs"
                  required
                />
              </div>

              {/* Comment Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Detailed Feedback</label>
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  rows={4}
                  placeholder="Share details regarding certificate verification, packaging, transit time..."
                  className="w-full text-xs font-medium rounded-xl border border-slate-200 p-3 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                className="w-full font-bold shadow-md shadow-blue-500/20"
              >
                Submit Verified Review
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
