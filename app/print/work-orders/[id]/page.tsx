'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { WorkOrder, WorkOrderType, WorkOrderStatus, User } from '@/lib/types'

interface WorkOrderWithDetails extends WorkOrder {
  application?: {
    id: string
    application_number: number
    customer_fullname: string
    customer_phone: string
    customer_type: string
    city: string
    street_and_house: string | null
    address_details: string | null
    service_type: string
    urgency: string
    status: string
  }
  executors?: Array<{
    id: string
    user_id: string
    is_lead: boolean
    created_at: string
    user?: User
  }>
  materials?: Array<{
    id: string
    material_id: string | null
    material_name: string
    unit: string
    quantity: number
    notes: string | null
    created_at: string
  }>
  created_by_user?: { id: string; full_name: string; email: string }
}

const typeLabels: Record<WorkOrderType, string> = {
  survey: 'Осмотр и расчёт',
  installation: 'Монтаж',
}

const serviceTypeLabels: Record<string, string> = {
  apartment: 'Квартира',
  office: 'Офис',
  scs: 'СКС',
  emergency: 'Аварийный вызов',
}

export default function WorkOrderPrintPage() {
  const params = useParams()
  const id = params.id as string
  const printRef1 = useRef<HTMLDivElement>(null)
  const printRef2 = useRef<HTMLDivElement>(null)

  const [workOrder, setWorkOrder] = useState<WorkOrderWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const fetchWorkOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`)
      const data = await res.json()
      if (res.ok) {
        setWorkOrder(data.work_order)
      }
    } catch {
      console.error('Error loading work order')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchWorkOrder()
  }, [fetchWorkOrder])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('ru-RU')
  }

  const handlePrint = () => {
    window.print()
  }

  const generatePDF = async (): Promise<jsPDF | null> => {
    if (!printRef1.current || !printRef2.current || !workOrder) return null

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    // Первая страница
    const canvas1 = await html2canvas(printRef1.current, {
      scale: 2,
      useCORS: true,
      logging: false,
    })
    const imgData1 = canvas1.toDataURL('image/png')
    const ratio1 = Math.min(pdfWidth / canvas1.width, pdfHeight / canvas1.height)
    pdf.addImage(imgData1, 'PNG', 0, 0, canvas1.width * ratio1, canvas1.height * ratio1)

    // Вторая страница
    pdf.addPage()
    const canvas2 = await html2canvas(printRef2.current, {
      scale: 2,
      useCORS: true,
      logging: false,
    })
    const imgData2 = canvas2.toDataURL('image/png')
    const ratio2 = Math.min(pdfWidth / canvas2.width, pdfHeight / canvas2.height)
    pdf.addImage(imgData2, 'PNG', 0, 0, canvas2.width * ratio2, canvas2.height * ratio2)

    return pdf
  }

  const handleSavePDF = async () => {
    if (!workOrder?.application?.id) return

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const pdf = await generatePDF()
      if (!pdf) return

      const pdfBlob = pdf.output('blob')
      const formData = new FormData()
      const fileName = `Наряд_${workOrder.work_order_number}_${new Date().toISOString().slice(0, 10)}.pdf`
      formData.append('file', pdfBlob, fileName)

      const uploadRes = await fetch(`/api/applications/${workOrder.application.id}/files`, {
        method: 'POST',
        body: formData,
      })

      if (uploadRes.ok) {
        setSaveMessage('PDF сохранён в файлы заявки')
      } else {
        const data = await uploadRes.json()
        setSaveMessage(`Ошибка: ${data.error || 'Не удалось сохранить'}`)
      }
    } catch (err) {
      console.error('Error saving PDF:', err)
      setSaveMessage('Ошибка при создании PDF')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!workOrder) return

    try {
      const pdf = await generatePDF()
      if (!pdf) return
      pdf.save(`Наряд_${workOrder.work_order_number}.pdf`)
    } catch (err) {
      console.error('Error downloading PDF:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    )
  }

  if (!workOrder) {
    return (
      <div className="p-6 bg-white min-h-screen">
        <p className="text-red-600">Наряд не найден</p>
      </div>
    )
  }

  const leadExecutor = workOrder.executors?.find(e => e.is_lead)
  const otherExecutors = workOrder.executors?.filter(e => !e.is_lead) || []

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Панель управления (скрывается при печати) */}
      <div className="no-print bg-white border-b shadow-sm p-4 sticky top-0 z-10">
        <div className="max-w-[210mm] mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold">Наряд №{workOrder.work_order_number}</h1>
          <div className="flex gap-2 items-center">
            {saveMessage && (
              <span className={`text-sm ${saveMessage.includes('Ошибка') ? 'text-red-600' : 'text-green-600'}`}>
                {saveMessage}
              </span>
            )}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Печать
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Скачать PDF
            </button>
            <button
              onClick={handleSavePDF}
              disabled={isSaving || !workOrder.application?.id}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {isSaving ? 'Сохранение...' : 'Сохранить в заявку'}
            </button>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>

      {/* Печатная форма */}
      <div className="py-8">
        <div
          ref={printRef1}
          className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none p-8 text-black text-sm"
          style={{ minHeight: '297mm' }}
        >
          {/* Шапка */}
          <div className="border-b-2 border-black pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold">НАРЯД №{workOrder.work_order_number}</h1>
                <p className="text-lg mt-1">{typeLabels[workOrder.type]}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">Дата выдачи: {formatDate(workOrder.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Информация о заявке */}
          <div className="mb-6">
            <h2 className="text-base font-bold mb-3 bg-gray-200 px-2 py-1">
              ЗАЯВКА №{workOrder.application?.application_number || '—'}
            </h2>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-600 w-32 align-top">Клиент:</td>
                  <td className="py-1.5 font-medium">{workOrder.application?.customer_fullname || '—'}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-600 align-top">Телефон:</td>
                  <td className="py-1.5 font-medium">{workOrder.application?.customer_phone || '—'}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-600 align-top">Адрес:</td>
                  <td className="py-1.5 font-medium">
                    {workOrder.application?.city}, {workOrder.application?.street_and_house}
                    {workOrder.application?.address_details && `, ${workOrder.application.address_details}`}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-600 align-top">Тип услуги:</td>
                  <td className="py-1.5">{workOrder.application?.service_type ? serviceTypeLabels[workOrder.application.service_type] || workOrder.application.service_type : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Планирование */}
          <div className="mb-6">
            <h2 className="text-base font-bold mb-3 bg-gray-200 px-2 py-1">ПЛАНИРОВАНИЕ</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-gray-600 text-sm">Дата:</span>
                <p className="font-medium">{formatDate(workOrder.scheduled_date)}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Время:</span>
                <p className="font-medium">{workOrder.scheduled_time?.slice(0, 5) || '—'}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Длительность:</span>
                <p className="font-medium">{workOrder.estimated_duration || '—'}</p>
              </div>
            </div>
          </div>

          {/* Исполнители */}
          <div className="mb-6">
            <h2 className="text-base font-bold mb-3 bg-gray-200 px-2 py-1">ИСПОЛНИТЕЛИ</h2>
            {workOrder.executors && workOrder.executors.length > 0 ? (
              <div className="space-y-1">
                {leadExecutor && (
                  <p>
                    <strong>1. {leadExecutor.user?.full_name || '—'}</strong>{' '}
                    <span className="text-gray-600">(бригадир)</span>
                  </p>
                )}
                {otherExecutors.map((ex, idx) => (
                  <p key={ex.id}>
                    {leadExecutor ? idx + 2 : idx + 1}. {ex.user?.full_name || '—'}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">Не назначены</p>
            )}
          </div>

          {/* Примечания */}
          {workOrder.notes && (
            <div className="mb-6">
              <h2 className="text-base font-bold mb-3 bg-gray-200 px-2 py-1">ПРИМЕЧАНИЯ</h2>
              <p className="whitespace-pre-wrap">{workOrder.notes}</p>
            </div>
          )}

          {/* Блок для подписей */}
          <div className="mt-8 pt-4 border-t border-gray-400">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm text-gray-600 mb-10">Выдал:</p>
                <div className="border-b border-black w-48 mb-1"></div>
                <p className="text-xs text-gray-500">(подпись, ФИО)</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-10">Принял:</p>
                <div className="border-b border-black w-48 mb-1"></div>
                <p className="text-xs text-gray-500">(подпись, ФИО)</p>
              </div>
            </div>
          </div>

          {/* Блок результата выполнения */}
          <div className="mt-8 pt-4 border-t border-gray-400">
            <h2 className="text-base font-bold mb-4">РЕЗУЛЬТАТ ВЫПОЛНЕНИЯ</h2>
            <div className="border border-gray-400 p-3 min-h-[80px] mb-4">
              {workOrder.result_notes || (
                <span className="text-gray-400 italic">(заполняется по факту выполнения)</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm">Дата выполнения: _______________</p>
              </div>
              <div>
                <p className="text-sm mb-8">Подпись исполнителя:</p>
                <div className="border-b border-black w-48"></div>
              </div>
            </div>
          </div>

          {/* Футер первой страницы */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500">
            <p>Документ сформирован: {new Date().toLocaleString('ru-RU')}</p>
            {workOrder.created_by_user && (
              <p>Создал: {workOrder.created_by_user.full_name}</p>
            )}
          </div>
        </div>

        {/* ВТОРАЯ СТРАНИЦА - Материалы */}
        <div
          ref={printRef2}
          className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none p-8 text-black text-sm mt-8 print:mt-0"
          style={{ minHeight: '297mm', pageBreakBefore: 'always' }}
        >
          {/* Шапка второй страницы */}
          <div className="border-b-2 border-black pb-4 mb-6">
            <h1 className="text-xl font-bold">НАРЯД №{workOrder.work_order_number} — МАТЕРИАЛЫ</h1>
            <p className="text-sm text-gray-600 mt-1">
              {workOrder.application?.customer_fullname} | {workOrder.application?.city}, {workOrder.application?.street_and_house}
            </p>
          </div>

          {/* Таблица материалов */}
          <div className="mb-6">
            <h2 className="text-base font-bold mb-3 bg-gray-200 px-2 py-1">СПИСОК МАТЕРИАЛОВ</h2>
            {workOrder.materials && workOrder.materials.length > 0 ? (
              <table className="w-full border-collapse border border-gray-400">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 px-2 py-1 text-left w-10">№</th>
                    <th className="border border-gray-400 px-2 py-1 text-left">Наименование</th>
                    <th className="border border-gray-400 px-2 py-1 text-center w-20">Кол-во</th>
                    <th className="border border-gray-400 px-2 py-1 text-center w-16">Ед.</th>
                    <th className="border border-gray-400 px-2 py-1 text-center w-24">Выдано</th>
                    <th className="border border-gray-400 px-2 py-1 text-center w-24">Возврат</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrder.materials.map((m, idx) => (
                    <tr key={m.id}>
                      <td className="border border-gray-400 px-2 py-1">{idx + 1}</td>
                      <td className="border border-gray-400 px-2 py-1">{m.material_name}</td>
                      <td className="border border-gray-400 px-2 py-1 text-center">{m.quantity}</td>
                      <td className="border border-gray-400 px-2 py-1 text-center">{m.unit}</td>
                      <td className="border border-gray-400 px-2 py-1 text-center"></td>
                      <td className="border border-gray-400 px-2 py-1 text-center"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 italic">Материалы не указаны</p>
            )}
          </div>

          {/* Подписи на странице материалов */}
          <div className="mt-12 pt-4 border-t border-gray-400">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm text-gray-600 mb-10">Материалы выдал:</p>
                <div className="border-b border-black w-48 mb-1"></div>
                <p className="text-xs text-gray-500">(подпись, ФИО)</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-10">Материалы получил:</p>
                <div className="border-b border-black w-48 mb-1"></div>
                <p className="text-xs text-gray-500">(подпись, ФИО)</p>
              </div>
            </div>
          </div>

          {/* Блок возврата материалов */}
          <div className="mt-12 pt-4 border-t border-gray-400">
            <h2 className="text-base font-bold mb-4">ВОЗВРАТ МАТЕРИАЛОВ</h2>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm text-gray-600 mb-10">Материалы сдал:</p>
                <div className="border-b border-black w-48 mb-1"></div>
                <p className="text-xs text-gray-500">(подпись, ФИО)</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-10">Материалы принял:</p>
                <div className="border-b border-black w-48 mb-1"></div>
                <p className="text-xs text-gray-500">(подпись, ФИО)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
          .shadow-lg { box-shadow: none !important; }
        }
        @page {
          size: A4;
          margin: 10mm;
        }
      `}</style>
    </div>
  )
}
