import * as XLSX from "xlsx";

export function exportExcel(filename: string, sheets: Record<string, any[]>) {
  const wb = XLSX.utils.book_new();

  Object.entries(sheets).forEach(([sheetName, rows]) => {
    const safeRows = rows?.length ? rows : [{ note: "Không có dữ liệu" }];
    const ws = XLSX.utils.json_to_sheet(safeRows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  });

  XLSX.writeFile(
    wb,
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
  );
}
