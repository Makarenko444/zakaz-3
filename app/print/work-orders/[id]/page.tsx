'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { WorkOrder, WorkOrderType, User } from '@/lib/types'

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
    contact_person: string | null
    contact_phone: string | null
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

// Стили для печатной формы (без Tailwind, только inline)
const styles = {
  page: {
    width: '210mm',
    minHeight: '297mm',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    padding: '32px',
    fontSize: '14px',
    color: '#000000',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box' as const,
  },
  header: {
    borderBottom: '2px solid #000000',
    paddingBottom: '16px',
    marginBottom: '24px',
  },
  headerFlex: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: 0,
  },
  subtitle: {
    fontSize: '18px',
    marginTop: '4px',
  },
  dateText: {
    fontSize: '14px',
    textAlign: 'right' as const,
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px',
    backgroundColor: '#e5e7eb',
    padding: '4px 8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  td: {
    padding: '6px 0',
    verticalAlign: 'top' as const,
  },
  tdLabel: {
    padding: '6px 16px 6px 0',
    color: '#6b7280',
    width: '120px',
    verticalAlign: 'top' as const,
  },
  tdValue: {
    padding: '6px 0',
    fontWeight: 500,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '16px',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '32px',
  },
  labelSmall: {
    fontSize: '14px',
    color: '#6b7280',
  },
  valueMedium: {
    fontWeight: 500,
  },
  signatureBlock: {
    marginTop: '32px',
    paddingTop: '16px',
    borderTop: '1px solid #9ca3af',
  },
  signatureLine: {
    borderBottom: '1px solid #000000',
    width: '192px',
    marginBottom: '4px',
    marginTop: '40px',
  },
  signatureLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },
  resultBox: {
    border: '1px solid #9ca3af',
    padding: '12px',
    minHeight: '80px',
    marginBottom: '16px',
  },
  footer: {
    marginTop: '32px',
    paddingTop: '16px',
    borderTop: '1px solid #d1d5db',
    fontSize: '12px',
    color: '#6b7280',
  },
  materialsTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    border: '1px solid #9ca3af',
  },
  th: {
    border: '1px solid #9ca3af',
    padding: '8px',
    textAlign: 'left' as const,
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
  },
  thCenter: {
    border: '1px solid #9ca3af',
    padding: '8px',
    textAlign: 'center' as const,
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
  },
  tdMaterial: {
    border: '1px solid #9ca3af',
    padding: '8px',
  },
  tdMaterialCenter: {
    border: '1px solid #9ca3af',
    padding: '8px',
    textAlign: 'center' as const,
  },
  italic: {
    fontStyle: 'italic',
    color: '#6b7280',
  },
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
    if (!printRef1.current || !printRef2.current || !workOrder) {
      console.error('Missing refs or workOrder')
      return null
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      // Первая страница (scale: 1.5 для баланса качества и размера)
      const canvas1 = await html2canvas(printRef1.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        removeContainer: true,
      })
      // Используем JPEG с качеством 0.8 вместо PNG для меньшего размера
      const imgData1 = canvas1.toDataURL('image/jpeg', 0.8)
      const ratio1 = Math.min(pdfWidth / canvas1.width, pdfHeight / canvas1.height)
      pdf.addImage(imgData1, 'JPEG', 0, 0, canvas1.width * ratio1, canvas1.height * ratio1)

      // Вторая страница
      pdf.addPage()
      const canvas2 = await html2canvas(printRef2.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        removeContainer: true,
      })
      const imgData2 = canvas2.toDataURL('image/jpeg', 0.8)
      const ratio2 = Math.min(pdfWidth / canvas2.width, pdfHeight / canvas2.height)
      pdf.addImage(imgData2, 'JPEG', 0, 0, canvas2.width * ratio2, canvas2.height * ratio2)

      return pdf
    } catch (err) {
      console.error('Error in generatePDF:', err)
      throw err
    }
  }

  const handleSavePDF = async () => {
    if (!workOrder?.application?.id) {
      setSaveMessage('Ошибка: заявка не найдена')
      return
    }

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const pdf = await generatePDF()
      if (!pdf) {
        setSaveMessage('Ошибка: не удалось создать PDF')
        return
      }

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
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка'
      setSaveMessage(`Ошибка: ${errorMessage}`)
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#ffffff' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid #6b7280', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    )
  }

  if (!workOrder) {
    return (
      <div style={{ padding: '24px', backgroundColor: '#ffffff', minHeight: '100vh' }}>
        <p style={{ color: '#dc2626' }}>Наряд не найден</p>
      </div>
    )
  }

  const leadExecutor = workOrder.executors?.find(e => e.is_lead)
  const otherExecutors = workOrder.executors?.filter(e => !e.is_lead) || []

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* Панель управления (скрывается при печати) */}
      <div className="no-print" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '210mm', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Наряд №{workOrder.work_order_number}</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {saveMessage && (
              <span style={{ fontSize: '14px', color: saveMessage.includes('Ошибка') ? '#dc2626' : '#16a34a' }}>
                {saveMessage}
              </span>
            )}
            <button
              onClick={handlePrint}
              style={{ padding: '8px 16px', backgroundColor: '#4b5563', color: '#ffffff', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Печать
            </button>
            <button
              onClick={handleDownloadPDF}
              style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Скачать PDF
            </button>
            <button
              onClick={handleSavePDF}
              disabled={isSaving || !workOrder.application?.id}
              style={{ padding: '8px 16px', backgroundColor: isSaving ? '#9ca3af' : '#16a34a', color: '#ffffff', borderRadius: '4px', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: !workOrder.application?.id ? 0.5 : 1 }}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить в заявку'}
            </button>
            <button
              onClick={() => window.close()}
              style={{ padding: '8px 16px', backgroundColor: '#ffffff', color: '#374151', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>

      {/* Печатная форма - Страница 1 */}
      <div style={{ padding: '32px 0' }}>
        <div ref={printRef1} style={styles.page}>
          {/* Шапка */}
          <div style={styles.header}>
            <div style={styles.headerFlex}>
              <div>
                <h1 style={styles.title}>НАРЯД №{workOrder.work_order_number}</h1>
                <p style={styles.subtitle}>{typeLabels[workOrder.type]}</p>
              </div>
              <div style={styles.dateText}>
                <p>Дата выдачи: {formatDate(workOrder.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Информация о заявке */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>ЗАЯВКА №{workOrder.application?.application_number || '—'}</h2>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={styles.tdLabel}>Клиент:</td>
                  <td style={styles.tdValue}>{workOrder.application?.customer_fullname || '—'}</td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Телефон:</td>
                  <td style={styles.tdValue}>{workOrder.application?.customer_phone || '—'}</td>
                </tr>
                {workOrder.application?.contact_person && (
                  <tr>
                    <td style={styles.tdLabel}>Контакт:</td>
                    <td style={styles.tdValue}>
                      {workOrder.application.contact_person}
                      {workOrder.application.contact_phone && `, тел: ${workOrder.application.contact_phone}`}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={styles.tdLabel}>Адрес:</td>
                  <td style={styles.tdValue}>
                    {workOrder.application?.city}, {workOrder.application?.street_and_house}
                    {workOrder.application?.address_details && `, ${workOrder.application.address_details}`}
                  </td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Тип услуги:</td>
                  <td style={styles.td}>{workOrder.application?.service_type ? serviceTypeLabels[workOrder.application.service_type] || workOrder.application.service_type : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Планирование */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>ПЛАНИРОВАНИЕ</h2>
            <div style={styles.grid3}>
              <div>
                <span style={styles.labelSmall}>Дата:</span>
                <p style={styles.valueMedium}>{formatDate(workOrder.scheduled_date)}</p>
              </div>
              <div>
                <span style={styles.labelSmall}>Время:</span>
                <p style={styles.valueMedium}>{workOrder.scheduled_time?.slice(0, 5) || '—'}</p>
              </div>
              <div>
                <span style={styles.labelSmall}>Длительность:</span>
                <p style={styles.valueMedium}>{workOrder.estimated_duration || '—'}</p>
              </div>
            </div>
          </div>

          {/* Исполнители */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>ИСПОЛНИТЕЛИ</h2>
            {workOrder.executors && workOrder.executors.length > 0 ? (
              <div>
                {leadExecutor && (
                  <p style={{ marginBottom: '4px' }}>
                    <strong>1. {leadExecutor.user?.full_name || '—'}</strong>{' '}
                    <span style={{ color: '#6b7280' }}>(бригадир)</span>
                  </p>
                )}
                {otherExecutors.map((ex, idx) => (
                  <p key={ex.id} style={{ marginBottom: '4px' }}>
                    {leadExecutor ? idx + 2 : idx + 1}. {ex.user?.full_name || '—'}
                  </p>
                ))}
              </div>
            ) : (
              <p style={styles.italic}>Не назначены</p>
            )}
          </div>

          {/* Примечания */}
          {workOrder.notes && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>ПРИМЕЧАНИЯ</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{workOrder.notes}</p>
            </div>
          )}

          {/* Блок для подписей */}
          <div style={styles.signatureBlock}>
            <div style={styles.grid2}>
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>Выдал:</p>
                <div style={styles.signatureLine}></div>
                <p style={styles.signatureLabel}>(подпись, ФИО)</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>Принял:</p>
                <div style={styles.signatureLine}></div>
                <p style={styles.signatureLabel}>(подпись, ФИО)</p>
              </div>
            </div>
          </div>

          {/* Блок результата выполнения */}
          <div style={styles.signatureBlock}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>РЕЗУЛЬТАТ ВЫПОЛНЕНИЯ</h2>
            <div style={styles.resultBox}>
              {workOrder.result_notes || (
                <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>(заполняется по факту выполнения)</span>
              )}
            </div>
            <div style={styles.grid2}>
              <div>
                <p style={{ fontSize: '14px' }}>Дата выполнения: _______________</p>
              </div>
              <div>
                <p style={{ fontSize: '14px' }}>Подпись исполнителя:</p>
                <div style={{ ...styles.signatureLine, marginTop: '32px' }}></div>
              </div>
            </div>
          </div>

          {/* Футер первой страницы */}
          <div style={styles.footer}>
            <p>Документ сформирован: {new Date().toLocaleString('ru-RU')}</p>
            {workOrder.created_by_user && (
              <p>Создал: {workOrder.created_by_user.full_name}</p>
            )}
          </div>
        </div>

        {/* ВТОРАЯ СТРАНИЦА - Материалы */}
        <div ref={printRef2} style={{ ...styles.page, marginTop: '32px' }}>
          {/* Шапка второй страницы */}
          <div style={styles.header}>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>НАРЯД №{workOrder.work_order_number} — МАТЕРИАЛЫ</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
              {workOrder.application?.customer_fullname} | {workOrder.application?.city}, {workOrder.application?.street_and_house}
            </p>
          </div>

          {/* Таблица материалов */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>СПИСОК МАТЕРИАЛОВ</h2>
            {workOrder.materials && workOrder.materials.length > 0 ? (
              <table style={styles.materialsTable}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '40px' }}>№</th>
                    <th style={styles.th}>Наименование</th>
                    <th style={{ ...styles.thCenter, width: '80px' }}>Кол-во</th>
                    <th style={{ ...styles.thCenter, width: '64px' }}>Ед.</th>
                    <th style={{ ...styles.thCenter, width: '96px' }}>Выдано</th>
                    <th style={{ ...styles.thCenter, width: '96px' }}>Возврат</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrder.materials.map((m, idx) => (
                    <tr key={m.id}>
                      <td style={styles.tdMaterial}>{idx + 1}</td>
                      <td style={styles.tdMaterial}>{m.material_name}</td>
                      <td style={styles.tdMaterialCenter}>{m.quantity}</td>
                      <td style={styles.tdMaterialCenter}>{m.unit}</td>
                      <td style={styles.tdMaterialCenter}></td>
                      <td style={styles.tdMaterialCenter}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={styles.italic}>Материалы не указаны</p>
            )}
          </div>

          {/* Подписи на странице материалов */}
          <div style={{ ...styles.signatureBlock, marginTop: '48px' }}>
            <div style={styles.grid2}>
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>Материалы выдал:</p>
                <div style={styles.signatureLine}></div>
                <p style={styles.signatureLabel}>(подпись, ФИО)</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>Материалы получил:</p>
                <div style={styles.signatureLine}></div>
                <p style={styles.signatureLabel}>(подпись, ФИО)</p>
              </div>
            </div>
          </div>

          {/* Блок возврата материалов */}
          <div style={{ ...styles.signatureBlock, marginTop: '48px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>ВОЗВРАТ МАТЕРИАЛОВ</h2>
            <div style={styles.grid2}>
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>Материалы сдал:</p>
                <div style={styles.signatureLine}></div>
                <p style={styles.signatureLabel}>(подпись, ФИО)</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>Материалы принял:</p>
                <div style={styles.signatureLine}></div>
                <p style={styles.signatureLabel}>(подпись, ФИО)</p>
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
        }
        @page {
          size: A4;
          margin: 10mm;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
