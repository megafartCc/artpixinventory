import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { CopyPlus, Search, Filter, MoreHorizontal } from "lucide-react";

export default async function ProductsPage() {
  const t = await getTranslations("Navigation");
  const products = await prisma.product.findMany({
    include: {
      categories: {
        include: {
          category: true
        }
      },
      stockLevels: true,
    },
  });

  return (
    <div className="p-6 lg:p-8 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("products")}</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Manage your master catalog and view global stock levels.
          </p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-sm">
          <CopyPlus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by SKU or Name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>
          <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Generic Data Grid - Responsive overflow */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-medium">SKU</th>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Global Stock</th>
                <th className="px-6 py-3 font-medium">Dimensions</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No products found in the catalog.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const globalStock = product.stockLevels.reduce(
                    (acc, curr) => acc + curr.quantity,
                    0
                  );
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {product.compoundId}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {product.categories.length === 0 ? (
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">Uncategorized</span>
                          ) : (
                            product.categories.map(pc => (
                              <span key={pc.categoryId} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                                {pc.category.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-medium ${
                            globalStock > 0 ? "text-emerald-600" : "text-rose-500"
                          }`}
                        >
                          {globalStock} units
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {product.length && product.width && product.height 
                          ? `${product.length}x${product.width}x${product.height} ${product.dimensionUnit}`
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-slate-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
