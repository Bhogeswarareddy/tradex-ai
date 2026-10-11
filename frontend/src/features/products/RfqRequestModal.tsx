import React, { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ProductDetailResponse } from "../../lib/api/products";
import { CheckCircle2, Send } from "lucide-react";

interface RfqRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductDetailResponse;
  onSubmitSuccess?: () => void;
}

export const RfqRequestModal: React.FC<RfqRequestModalProps> = ({
  isOpen,
  onClose,
  product,
  onSubmitSuccess,
}) => {
  const [quantity, setQuantity] = useState(String(product.moq || 20000));
  const [targetPrice, setTargetPrice] = useState(
    product.price_tiers.length > 0 ? String(product.price_tiers[0].unit_price) : "3.00"
  );
  const [incoterm, setIncoterm] = useState("CIF");
  const [destinationPort, setDestinationPort] = useState("Hamburg Port (DE)");
  const [notes, setNotes] = useState(
    `Looking for export delivery of ${product.name} with batch COA and phytosanitary certificates.`
  );
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      if (onSubmitSuccess) onSubmitSuccess();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Quotation (RFQ)"
      footer={
        submitted ? (
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                const params = new URLSearchParams({
                  product: product.name,
                  title: `Procurement of ${product.name}`,
                  quantity: quantity,
                  unit: product.unit,
                  origin_country: product.origin_country,
                  incoterm: incoterm,
                  destination_port: destinationPort,
                  lead_time_days: String(product.lead_time_days),
                  supplier_id: product.supplier.id,
                });
                window.location.href = `/rfqs?${params.toString()}`;
              }}
            >
              Open Full RFQ Wizard
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={loading}
              onClick={handleSubmit}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Submit RFQ to Supplier
            </Button>
          </>
        )
      }
    >
      {submitted ? (
        <div className="py-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">RFQ Successfully Broadcast!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Your quotation request for <strong>{quantity} {product.unit}</strong> has been sent directly to{" "}
            <strong>{product.supplier.name}</strong>. You will receive an alert once their counter-offer is logged.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/60 flex items-center gap-3">
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-12 h-12 object-cover rounded-lg border border-blue-200 shrink-0"
            />
            <div className="min-w-0">
              <h4 className="font-bold text-xs text-slate-900 truncate">{product.name}</h4>
              <p className="text-[11px] text-slate-500">
                Supplier: <strong className="text-slate-700">{product.supplier.name}</strong> • Origin: {product.origin_country}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Order Quantity (${product.unit})`}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              min={product.moq}
            />
            <Input
              label="Target Unit Price ($ USD)"
              type="number"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Incoterm"
              value={incoterm}
              onChange={(e) => setIncoterm(e.target.value)}
              options={[
                { value: "CIF", label: "CIF - Cost, Insurance & Freight" },
                { value: "FOB", label: "FOB - Free on Board" },
                { value: "EXW", label: "EXW - Ex Works" },
                { value: "DDP", label: "DDP - Delivered Duty Paid" },
              ]}
            />
            <Input
              label="Destination Port"
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Specification Requirements & Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-700"
            />
          </div>
        </form>
      )}
    </Modal>
  );
};
