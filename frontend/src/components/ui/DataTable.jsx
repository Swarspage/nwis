import { formatValue } from "../../utils/format.js";
import "./ui.css";

export default function DataTable({ columns, rows, empty = "No rows available" }) {
  if (!rows?.length) {
    return <div className="state-panel"><p className="state-copy">{empty}</p></div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || `${row.timestamp || "row"}-${row.model_name || row.name || rowIndex}-${rowIndex}`}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : formatValue(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
