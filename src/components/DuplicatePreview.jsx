import { useState, useCallback, useEffect } from 'react'
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table'
import { FiCheck, FiX } from 'react-icons/fi'

const columnHelper = createColumnHelper()

const formatTMXDate = (tmxDate) => {
  if (!tmxDate || tmxDate === '-') return '-'
  
  const year = tmxDate.substring(0, 4)
  const month = tmxDate.substring(4, 6)
  const day = tmxDate.substring(6, 8)
  const hour = tmxDate.substring(9, 11)
  const minute = tmxDate.substring(11, 13)
  const second = tmxDate.substring(13, 15)

  return (
    <div className="whitespace-nowrap">
      <div>{`${year}-${month}-${day}`}</div>
      <div className="text-[#676767]">{`${hour}:${minute}:${second}`}</div>
    </div>
  )
}

export default function DuplicatePreview({ duplicates: initialDuplicates, onStatusChange }) {
  const [duplicates, setDuplicates] = useState(initialDuplicates)

  useEffect(() => {
    setDuplicates(initialDuplicates)
  }, [initialDuplicates])

  const handleStatusChange = useCallback((rowIndex, newStatus) => {
    setDuplicates(prevDuplicates => {
      const currentRow = prevDuplicates[rowIndex]
      const updatedDuplicates = prevDuplicates.map(dup => {
        if (dup.sourceText === currentRow.sourceText && 
            dup.targetText === currentRow.targetText) {
          return {
            ...dup,
            status: dup === currentRow ? newStatus : 'delete'
          }
        }
        return dup
      })
      
      if (onStatusChange) {
        onStatusChange(updatedDuplicates)
      }
      
      return updatedDuplicates
    })
  }, [onStatusChange])

  const columns = [
    columnHelper.accessor('sourceText', {
      header: 'Source Language',
      cell: info => info.getValue(),
      size: 200
    }),
    columnHelper.accessor('targetText', {
      header: 'Target Language',
      cell: info => info.getValue(),
      size: 200
    }),
    columnHelper.accessor('creationId', {
      header: 'Creation ID',
      cell: info => info.getValue() || '-',
      size: 120
    }),
    columnHelper.accessor('changeId', {
      header: 'Change ID',
      cell: info => info.getValue() || '-',
      size: 120
    }),
    columnHelper.accessor('creationDate', {
      header: 'Creation Date',
      cell: info => formatTMXDate(info.getValue()),
      size: 120
    }),
    columnHelper.accessor('changeDate', {
      header: 'Change Date',
      cell: info => formatTMXDate(info.getValue()),
      size: 120
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <select
          value={info.getValue()}
          onChange={(e) => handleStatusChange(info.row.index, e.target.value)}
          className={`px-2 py-1 rounded-md border ${
            info.getValue() === 'keep' 
              ? 'bg-green-500 bg-opacity-10 border-green-500 text-green-500' 
              : 'bg-red-500 bg-opacity-10 border-red-500 text-red-500'
          }`}
        >
          <option value="keep">Keep</option>
          <option value="delete">Delete</option>
        </select>
      ),
      size: 100
    })
  ]

  const table = useReactTable({
    data: duplicates,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  return (
    <div className="mt-6">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-white bg-[#2d2d2d] first:rounded-tl-lg last:rounded-tr-lg"
                    style={{ width: header.column.columnDef.size }}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className="border-b border-[#2d2d2d] last:border-0"
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className="px-4 py-3"
                    style={{ width: cell.column.columnDef.size }}
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}