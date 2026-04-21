import { listProducts } from "@/lib/products/actions";
import { ProductsTable } from "@/components/dashboard/ProductsTable";

export default async function ProductsPage() {
  const products = await listProducts();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Productos</h1>
      <ProductsTable initialProducts={products} />
    </div>
  );
}
