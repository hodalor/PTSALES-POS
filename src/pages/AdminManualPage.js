import { useSelector } from 'react-redux';

function Section({ title, children }) {
  return (
    <section className="card" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function AdminManualPage() {
  const settings = useSelector(s => s.settings);
  const branches = useSelector(s => s.branches.branches);
  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 16 }}>
        <h1 style={{ marginTop: 0 }}>System Manual</h1>
        <div style={{ color: '#64748b' }}>
          This guide explains how to use every major feature: what each page does, when to use it, and how product units, attributes, packs, and variants work across the system.
        </div>
      </div>

      <Section title="Navigation Overview">
        <ul>
          <li>Dashboard: High‑level metrics (Admin/Manager).</li>
          <li>POS: Sell items, take payments, print receipts, handle tax overrides.</li>
          <li>Sales: View historical sales, invoice numbers, receipt links.</li>
          <li>Products: Create/edit products with units, attributes, packs and variants.</li>
          <li>Inventory: Set stock per branch; manage per‑variant stock.</li>
          <li>Purchases: Receive stock (supports packs and variants).</li>
          <li>Transfers: Move stock between branches (supports variants).</li>
          <li>Adjustments: Correct stock up/down with remarks (supports variants).</li>
          <li>Labels: Print barcode labels (products and their variants).</li>
          <li>Suppliers & Customers: Maintain master data and contacts.</li>
          <li>Refunds: Placeholder for returns workflow.</li>
          <li>Reports: Export sales CSV, totals by time/seller/branch.</li>
          <li>Users: Manage user accounts and roles.</li>
          <li>Cash Drawer: Open drawer logs and operations.</li>
          <li>Config: Store info, receipt header/footer, taxes, invoice serials, phone, website.</li>
          <li>Audit Log: Track sensitive actions (stock, sales, overrides).</li>
        </ul>
      </Section>

      <Section title="Products – Units, Attributes, Packs, Variants">
        <p><strong>When to use each option</strong></p>
        <ul>
          <li>Units:
            <ul>
              <li>Volume (mL/L): Beverages (e.g., Soda 330mL, Water 1.5L). Set unitKind=volume, unitValue=330, unitSymbol=mL.</li>
              <li>Mass (g/kg): Foods or materials (e.g., Flour 1kg). Set unitKind=mass, value and symbol.</li>
              <li>Length (mm/cm/in): Cables, rods, fabrics by length. Set unitKind=length with symbol.</li>
              <li>Size: Apparel sizes like S/M/L or labels such as “Large”. Use sizeLabel.</li>
              <li>Shoe: Numeric shoe sizes (e.g., 42 EU). Use shoeSize.</li>
              <li>None: Generic items without a measurable unit.</li>
            </ul>
          </li>
          <li>Attributes: Free‑form key/value like Model, RAM, Storage, Color. Use for devices (e.g., Laptop with Model=ThinkPad, RAM=16GB, SSD=512GB) or any extra descriptors.</li>
          <li>Packs: Unit conversions for receiving stock in bulk (e.g., Case (24) for bottled drinks). Purchases multiply pack quantity to base units automatically.</li>
          <li>Variants: Per‑option SKUs like T‑Shirt (Small/Medium/Large) or Shoe (42/43). Each variant has its own price (optional) and branch stock.</li>
        </ul>
        <p><strong>Spec display</strong></p>
        <ul>
          <li>The system builds a product spec from unit/size/shoe/attributes and shows it in Products, POS, Sales, Receipts and Labels.</li>
          <li>Variant label is appended to the base name, e.g., “T‑Shirt (Large)”.</li>
        </ul>
        <p><strong>Best practices</strong></p>
        <ul>
          <li>Pick a single base unit per product (e.g., bottles). Use Packs to define cases/crates.</li>
          <li>Use Attributes for descriptive fields; don’t overload product name.</li>
          <li>Create Variants when each option needs its own stock count or barcode/SKU.</li>
        </ul>
      </Section>

      <Section title="POS – Selling, Stock Checks, Receipts">
        <ul>
          <li>Search by name, SKU or scan barcode. Variants appear as separate items.</li>
          <li>Stock checks use the current branch and the specific variant’s stock.</li>
          <li>Discount: Apply a cart‑level discount amount.</li>
          <li>Tax override (if role allows): Enter override % and required remark; recorded in Audit Log.</li>
          <li>Payments: Add multiple methods with amounts (cash/card/mobile/wallet). System prevents completion until fully paid.</li>
          <li>Invoice Number: Auto‑generated as Prefix‑Branch‑NNNNNN (configured in Settings).</li>
          <li>Receipts: Prints branded HTML receipt; offline QR embeds a local SVG; also supports ESC/POS text download.</li>
          <li>Offline: If offline, the sale is queued and syncs later. Receipt still prints.</li>
        </ul>
      </Section>

      <Section title="Sales – History and Exports">
        <ul>
          <li>Lists sales with invoice serials, seller, branch and totals.</li>
          <li>Click to view/print receipt; public receipt link is accessible from the ID.</li>
          <li>CSV export available in Reports for analytics.</li>
        </ul>
      </Section>

      <Section title="Inventory – Branch & Variants">
        <ul>
          <li>Choose branch to view/edit stock levels.</li>
          <li>If a product has variants, click “Variants” to edit per‑variant stock for the branch.</li>
          <li>Modal shows branch breakdown and a dedicated “Variants (current branch)” editor.</li>
        </ul>
      </Section>

      <Section title="Purchases – Receive Stock with Packs & Variants">
        <ul>
          <li>Select Product → Variant (if any) → Pack (e.g., Case (24)) → Quantity to receive.</li>
          <li>System converts Pack × Qty to base units and increments that branch/variant stock.</li>
          <li>Audit Log records supplier, cost, chosen pack and conversion factor.</li>
        </ul>
      </Section>

      <Section title="Transfers – Move Stock Between Branches">
        <ul>
          <li>Select Product → Variant (if any) → From/To Branch → Quantity → Transfer.</li>
          <li>Audit Log records who transferred, from/to branches, variant and quantity.</li>
        </ul>
      </Section>

      <Section title="Adjustments – Correct Stock">
        <ul>
          <li>Select Product → Variant (if any) → Branch → Delta (+/‑) → Apply with a required remark.</li>
          <li>Use for corrections, write‑offs or cycle count differences. All actions are audited.</li>
        </ul>
      </Section>

      <Section title="Labels – Print Barcodes">
        <ul>
          <li>Search/select products or variants; set copy count; print grid‑formatted labels.</li>
          <li>If a variant has its own SKU/barcode, it prints that; otherwise prints base product barcode.</li>
        </ul>
      </Section>

      <Section title="Cash Drawer – Sessions and Drawer Control">
        <ul>
          <li>Open Session: Enter opening float on the Cash Drawer page and open the session at shift start.</li>
          <li>Record Movements: Use “Cash In” for deposits and “Cash Out” for payouts; include notes for auditing.</li>
          <li>Expected Cash: The page shows Opening Float + In − Out; compare during close.</li>
          <li>Close Session: When ending the shift, close to lock entries and preserve totals.</li>
          <li>Open Drawer Now: Use the “Open Drawer Now” button to generate a tiny ESC/POS file that pulses the drawer immediately, without affecting automatic open‑on‑sale settings.</li>
          <li>Physical Drawer: When configured in Config and using cash payments, the drawer open command is also included with ESC/POS output at POS completion.</li>
        </ul>
      </Section>

      <Section title="Suppliers & Customers">
        <ul>
          <li>Add and edit contacts for purchasing and sales.</li>
          <li>Confirmation dialogs use the system modal (no browser alerts).</li>
        </ul>
      </Section>

      <Section title="Config – Company & Receipt Settings">
        <ul>
          <li>App/Store: Name, website, phone, receipt header/footer.</li>
          <li>Taxes: Default tax rate. Roles may override at POS with remark (audited).</li>
          <li>Invoice: Prefix and next number. System increments after each completed sale.</li>
          <li>QR: Offline QR generation embedded into receipts (no external service).</li>
        </ul>
      </Section>

      <Section title="Audit Log – Compliance">
        <ul>
          <li>Tracks stock receives, transfers, adjustments, tax overrides, and sale completions.</li>
          <li>Filter and export as needed for reviews.</li>
        </ul>
      </Section>

      <Section title="Roles & Access">
        <ul>
          <li>Admin: Full access, including Users, Config, Audit Log.</li>
          <li>Manager: POS, Inventory, Reports; may see Dashboard.</li>
          <li>Inventory Staff: Products, Inventory, Purchases, Transfers, Adjustments, Labels.</li>
          <li>Cashier: POS, Sales, Cash Drawer, Customers.</li>
        </ul>
      </Section>

      <Section title="Troubleshooting & Tips">
        <ul>
          <li>Variants: Use when stock differs per option; give SKUs for scanning.</li>
          <li>Packs: Define the most common bulk receive units to save time.</li>
          <li>Receipts: Keep phone and footer updated in Config for customer clarity.</li>
          <li>Offline: Sales queue automatically; ensure sync completes when back online.</li>
        </ul>
      </Section>
    </div>
  );
}

export default AdminManualPage;
