import { CsvImportClient } from "@/components/products/CsvImportClient";

export default function ProductImportPage({
  params,
}: {
  params: { locale: string };
}) {
  return <CsvImportClient locale={params.locale} />;
}
