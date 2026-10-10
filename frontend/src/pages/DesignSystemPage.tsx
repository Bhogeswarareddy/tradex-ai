import React, { useState } from "react";
import {
  Button,
  Input,
  Select,
  Card,
  KpiCard,
  Badge,
  Chip,
  Rating,
  Avatar,
  Modal,
  Drawer,
  Tabs,
  Skeleton,
  useToast,
  ProgressStepper,
  FilterBar,
  DataTable,
  Column,
} from "../components/ui";
import {
  Send,
  Trash2,
  Mail,
  Search,
  DollarSign,
  TrendingUp,
  Package,
  ShieldCheck,
  Globe,
} from "lucide-react";

interface SampleRow {
  id: string;
  name: string;
  category: string;
  price: string;
  origin: string;
  status: "verified" | "pending" | "in_progress";
}

const SAMPLE_DATA: SampleRow[] = [
  { id: "1", name: "Premium Organic Cardamom", category: "Spices", price: "$42.50 / kg", origin: "India", status: "verified" },
  { id: "2", name: "Grade-A Raw Cotton Bales", category: "Textiles", price: "$1.85 / lb", origin: "India", status: "verified" },
  { id: "3", name: "CNC Lathe Turning Machine", category: "Machinery", price: "$28,500.00", origin: "Germany", status: "in_progress" },
  { id: "4", name: "Basmati Rice 1121 Sella", category: "Agriculture", price: "$980.00 / MT", origin: "India", status: "verified" },
  { id: "5", name: "Solar PV Inverter 50kW", category: "Renewables", price: "$4,200.00", origin: "Vietnam", status: "pending" },
];

export const DesignSystemPage: React.FC = () => {
  const { success, error, warning, info } = useToast();

  // Interactive states
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTabUnderline, setActiveTabUnderline] = useState("overview");
  const [activeTabPills, setActiveTabPills] = useState("all");
  const [selectedChip, setSelectedChip] = useState<string>("agri");
  const [searchVal, setSearchVal] = useState("");
  const [stepperStep, setStepperStep] = useState(1);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>(["1"]);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const tableColumns: Column<SampleRow>[] = [
    {
      key: "name",
      header: "Product / Item",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-400">{row.origin}</p>
        </div>
      ),
    },
    { key: "category", header: "Category", sortable: true },
    { key: "price", header: "Unit Price", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        if (row.status === "verified") return <Badge variant="green">VERIFIED</Badge>;
        if (row.status === "in_progress") return <Badge variant="blue">IN PROGRESS</Badge>;
        return <Badge variant="amber">PENDING</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-12 pb-16">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-[#2563EB] uppercase tracking-wider">
            TradeX UI Foundation
          </span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
          Design System & Component Showcase
        </h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          A unified collection of typed, accessible UI components built with Tailwind CSS, tokens, and Lucide icons.
        </p>
      </div>

      {/* 1. BUTTONS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
          1. Buttons & Variants
        </h2>
        <Card>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Variants</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="danger" icon={<Trash2 className="w-4 h-4" />}>
                  Danger Action
                </Button>
                <Button variant="ghost">Ghost Button</Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Sizes & States</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small (sm)</Button>
                <Button size="md">Medium (md)</Button>
                <Button size="lg">Large (lg)</Button>
                <Button isLoading>Loading State</Button>
                <Button disabled>Disabled Button</Button>
                <Button variant="primary" icon={<Send className="w-4 h-4" />}>
                  With Icon
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 2. KPI CARDS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
          2. KPI & Metric Cards
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Trade Volume"
            value="$1,420,800"
            delta="+18.4%"
            isPositive={true}
            description="vs last 30 days"
            icon={<DollarSign className="w-5 h-5" />}
          />
          <KpiCard
            title="Active RFQs"
            value="42"
            delta="+8.2%"
            isPositive={true}
            description="12 awaiting quotes"
            icon={<Package className="w-5 h-5" />}
          />
          <KpiCard
            title="Verified Suppliers"
            value="156"
            delta="+24 this month"
            isPositive={true}
            description="99.4% on-time rate"
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <KpiCard
            title="Average Lead Time"
            value="14 Days"
            delta="-3.5 days"
            isPositive={true}
            description="Optimized routing"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>
      </section>

      {/* 3. INPUTS & SELECTS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
          3. Form Controls & Inputs
        </h2>
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Input
              label="Standard Text Input"
              placeholder="Enter product title..."
              helper="Helper text guidance"
            />
            <Input
              label="With Start Icon"
              placeholder="user@domain.com"
              icon={<Mail className="w-4 h-4" />}
            />
            <Input
              label="Input with Error State"
              placeholder="Invalid value"
              error="Minimum 10 characters required"
              defaultValue="short"
            />
            <Select
              label="Single Select"
              options={[
                { value: "fob", label: "FOB - Free on Board" },
                { value: "cif", label: "CIF - Cost, Insurance, Freight" },
                { value: "exw", label: "EXW - Ex Works" },
              ]}
              defaultValue="fob"
            />
            <Input
              label="Disabled Input"
              placeholder="Read only content"
              disabled
              defaultValue="Pre-configured immutable value"
            />
            <Input
              label="Search Input"
              placeholder="Search HS codes..."
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </Card>
      </section>

      {/* 4. BADGES, CHIPS & RATINGS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
          4. Badges, Chips & Ratings
        </h2>
        <Card>
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Status Badges</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="green">VERIFIED</Badge>
                <Badge variant="blue">IN PROGRESS</Badge>
                <Badge variant="amber">PENDING APPROVAL</Badge>
                <Badge variant="red">REJECTED</Badge>
                <Badge variant="gray">DRAFT</Badge>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Interactive Chips</p>
              <div className="flex flex-wrap gap-2">
                <Chip
                  label="Agricultural Commodities"
                  selected={selectedChip === "agri"}
                  onClick={() => setSelectedChip("agri")}
                />
                <Chip
                  label="Spices & Seasonings"
                  selected={selectedChip === "spices"}
                  onClick={() => setSelectedChip("spices")}
                />
                <Chip
                  label="Textiles & Apparel"
                  selected={selectedChip === "textiles"}
                  onClick={() => setSelectedChip("textiles")}
                />
                <Chip
                  label="Machinery & Tools"
                  selected={selectedChip === "machinery"}
                  onClick={() => setSelectedChip("machinery")}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Supplier Star Ratings</p>
              <div className="flex flex-wrap items-center gap-6">
                <Rating score={4.9} count={128} />
                <Rating score={4.2} count={45} />
                <Rating score={3.5} count={12} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">User & Company Avatars</p>
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name="Bhogeswara Reddy" size="sm" status="online" />
                <Avatar name="Sri Bharat Spices" size="md" status="online" />
                <Avatar name="Global Exporters Ltd" size="lg" status="offline" />
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 5. TABS & PROGRESS STEPPER */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
          5. Tabs & Steppers
        </h2>
        <Card>
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Underline Tabs</p>
              <Tabs
                activeTab={activeTabUnderline}
                onChange={setActiveTabUnderline}
                tabs={[
                  { id: "overview", label: "Overview" },
                  { id: "products", label: "Catalog", badge: "60" },
                  { id: "compliance", label: "Certifications", badge: "4" },
                  { id: "reviews", label: "Trade Reviews" },
                ]}
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Pills Variant</p>
              <Tabs
                variant="pills"
                activeTab={activeTabPills}
                onChange={setActiveTabPills}
                tabs={[
                  { id: "all", label: "All Items" },
                  { id: "verified", label: "Verified Only" },
                  { id: "spot", label: "Spot Orders" },
                ]}
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-4 uppercase">
                Progress Stepper (Stage {stepperStep + 1} of 4)
              </p>
              <ProgressStepper
                currentStep={stepperStep}
                steps={[
                  { id: "s1", label: "RFQ Created", description: "Target specs" },
                  { id: "s2", label: "Supplier Quotes", description: "Bids received" },
                  { id: "s3", label: "Contract Signed", description: "Escrow funded" },
                  { id: "s4", label: "Shipment Dispatched", description: "Customs cleared" },
                ]}
              />
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStepperStep((s) => Math.max(0, s - 1))}
                  disabled={stepperStep === 0}
                >
                  Previous Step
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setStepperStep((s) => Math.min(3, s + 1))}
                  disabled={stepperStep === 3}
                >
                  Next Step
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 6. TOASTS, MODALS & DRAWERS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
          6. Overlays & Feedback (Modals, Drawers & Toasts)
        </h2>
        <Card>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Toast Notifications</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => success("Quote Submitted", "Your RFQ bid has been broadcast to suppliers.")}
                >
                  Trigger Success Toast
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => error("Authorization Failed", "Your session has expired. Please sign in.")}
                >
                  Trigger Error Toast
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => warning("Simulated Sandbox", "Transaction will not execute real bank wire transfer.")}
                >
                  Trigger Warning Toast
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => info("New Message Received", "Sri Bharat Spices sent an updated proforma invoice.")}
                >
                  Trigger Info Toast
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-4">
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Open Interactive Modal
              </Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                Open Slide-out Drawer
              </Button>
            </div>
          </div>
        </Card>

        {/* Modal Demo */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Confirm Trade Contract Order"
          footer={
            <>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setModalOpen(false);
                  success("Contract Approved", "Order confirmed with escrow lock.");
                }}
              >
                Approve & Execute
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            You are about to issue a purchase order for <strong>5,000 kg Premium Organic Cardamom</strong> with
            Incoterm <strong>FOB Mundra Port</strong>.
          </p>
          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-500">
            Total Target Escrow: <strong>$212,500.00 USD</strong>
          </div>
        </Modal>

        {/* Drawer Demo */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Advanced Search Filters"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>
                Reset
              </Button>
              <Button variant="primary" size="sm" onClick={() => setDrawerOpen(false)}>
                Apply Filters
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input label="Country of Origin" placeholder="e.g. India, Vietnam..." icon={<Globe className="w-4 h-4" />} />
            <Input label="Minimum Trust Score" placeholder="e.g. 90%" icon={<ShieldCheck className="w-4 h-4" />} />
            <Select
              label="Incoterm"
              options={[
                { value: "any", label: "Any Incoterm" },
                { value: "fob", label: "FOB" },
                { value: "cif", label: "CIF" },
              ]}
            />
          </div>
        </Drawer>
      </section>

      {/* 7. FILTERBAR & DATA TABLE */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
          7. FilterBar & DataTable
        </h2>
        <FilterBar
          searchValue={searchVal}
          onSearchChange={setSearchVal}
          searchPlaceholder="Filter items by title, category, origin..."
          filterCount={2}
          onFilterClick={() => setDrawerOpen(true)}
          chips={[
            { id: "all", label: "All Items", active: true },
            { id: "verified", label: "Verified Only", active: false },
            { id: "in_stock", label: "Immediate Dispatch", active: false },
          ]}
        />

        <DataTable
          columns={tableColumns}
          data={SAMPLE_DATA}
          keyExtractor={(r) => r.id}
          selectable
          selectedIds={selectedRowIds}
          onSelectRow={(id) => {
            setSelectedRowIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            );
          }}
          onSelectAll={() => {
            if (selectedRowIds.length === SAMPLE_DATA.length) {
              setSelectedRowIds([]);
            } else {
              setSelectedRowIds(SAMPLE_DATA.map((r) => r.id));
            }
          }}
          sortState={{
            columnKey: sortKey,
            direction: sortDir,
            onSort: (col) => {
              if (sortKey === col) {
                setSortDir(sortDir === "asc" ? "desc" : "asc");
              } else {
                setSortKey(col);
                setSortDir("asc");
              }
            },
          }}
          pagination={{
            currentPage: currentPage,
            totalPages: 3,
            totalCount: 15,
            onPageChange: setCurrentPage,
          }}
        />
      </section>

      {/* 8. SKELETONS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
          8. Skeletons & Shimmer States
        </h2>
        <Card>
          <div className="space-y-4 max-w-md">
            <div className="flex items-center gap-3">
              <Skeleton variant="circular" width={44} height={44} />
              <div className="space-y-2 flex-1">
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </div>
            </div>
            <Skeleton variant="rectangular" height={90} className="w-full" />
          </div>
        </Card>
      </section>
    </div>
  );
};
