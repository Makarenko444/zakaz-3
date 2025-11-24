'use client'

import { useEffect, useMemo, useState } from 'react'

interface InstallerProfile {
  id: string
  full_name: string
  email: string
  region: string
  node: string
  skills: string[]
  phone: string
  availability: string[]
  workload: number
  activeAssignments: number
}

interface BrigadeAssignment {
  id: string
  objectName: string
  region: string
  node: string
  requestedSkills: string[]
  capacity: number
  window: string
  installers: string[]
  responsibleId: string
  comment: string
}

const skillOptions = [
  'Оптика',
  'Сварка',
  'СКУД',
  'Эл. часть',
  'ЛВС/ВОЛС',
  'ПНР',
]

const objectPresets = [
  {
    id: 'obj-1',
    name: 'ТЦ «Променада»',
    region: 'Москва',
    node: 'Node-21',
    address: 'Кутузовский пр-т, 45',
  },
  {
    id: 'obj-2',
    name: 'БЦ «Лайнер»',
    region: 'Москва',
    node: 'Node-07',
    address: 'Ленинградский пр-т, 64',
  },
  {
    id: 'obj-3',
    name: 'ТК «Норд»',
    region: 'Санкт-Петербург',
    node: 'Node-03',
    address: 'Приморский пр-т, 72',
  },
]

const availabilityTemplates = [
  ['Сегодня 10:00–14:00', 'Завтра 12:00–16:00', 'Чт 09:00–18:00'],
  ['Сегодня 13:00–18:00', 'Пт 10:00–15:00', 'Сб 09:00–13:00'],
  ['Завтра 09:00–17:00', 'Пт 12:00–18:00', 'Вс 10:00–14:00'],
]

export default function BrigadesPage() {
  const [installers, setInstallers] = useState<InstallerProfile[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInstallers, setSelectedInstallers] = useState<string[]>([])
  const [responsibleId, setResponsibleId] = useState<string>('')
  const [capacity, setCapacity] = useState<number>(2)
  const [objectName, setObjectName] = useState('')
  const [node, setNode] = useState('')
  const [region, setRegion] = useState('Москва')
  const [comment, setComment] = useState('')
  const [window, setWindow] = useState('Завтра 12:00–16:00')
  const [assignments, setAssignments] = useState<BrigadeAssignment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadInstallers()
  }, [])

  async function loadInstallers() {
    try {
      setIsLoading(true)
      const response = await fetch('/api/users')
      if (!response.ok) throw new Error('Не удалось загрузить пользователей')

      const data = await response.json()
      const installersFromApi = (data.users || []).filter(
        (user: { role: string }) => user.role === 'installer',
      )

      const fallbackRegions = ['Москва', 'Санкт-Петербург', 'Нижний Новгород']
      const fallbackNodes = ['Node-07', 'Node-12', 'Node-03', 'Node-21']

      const enriched = installersFromApi.map(
        (
          user: {
            id: string
            full_name: string
            email: string
            phone?: string | null
          },
          index: number,
        ),
      )
        .filter(Boolean)
        .map((user, index) => {
          const availability =
            availabilityTemplates[index % availabilityTemplates.length]
          const skills = [
            skillOptions[index % skillOptions.length],
            skillOptions[(index + 2) % skillOptions.length],
          ]

          return {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone || '+7 (900) 000-00-00',
            region: fallbackRegions[index % fallbackRegions.length],
            node: fallbackNodes[index % fallbackNodes.length],
            skills,
            availability,
            workload: 20 + index * 8,
            activeAssignments: (index % 3) + 1,
          }
        })

      setInstallers(enriched)
      const preset = objectPresets[0]
      setObjectName(preset.name)
      setNode(preset.node)
      setRegion(preset.region)
    } catch (error) {
      console.error('Ошибка загрузки монтажников', error)
      setMessage('Не удалось загрузить монтажников. Проверьте подключение к API.')
    } finally {
      setIsLoading(false)
    }
  }

  const regions = useMemo(
    () => ['all', ...Array.from(new Set(installers.map(installer => installer.region)))],
    [installers],
  )

  const filteredInstallers = useMemo(() => {
    return installers.filter(installer => {
      const matchesRegion = selectedRegion === 'all' || installer.region === selectedRegion
      const matchesSkills = selectedSkills.every(skill => installer.skills.includes(skill))
      const matchesSearch = installer.full_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      return matchesRegion && matchesSkills && matchesSearch
    })
  }, [installers, selectedRegion, selectedSkills, searchQuery])

  const commonSlots = useMemo(() => {
    if (selectedInstallers.length === 0) return []
    const selectedProfiles = installers.filter(installer =>
      selectedInstallers.includes(installer.id),
    )

    const slotCounts = new Map<string, number>()
    selectedProfiles.forEach(profile => {
      profile.availability.forEach(slot => {
        slotCounts.set(slot, (slotCounts.get(slot) || 0) + 1)
      })
    })

    return Array.from(slotCounts.entries())
      .filter(([, count]) => count === selectedProfiles.length)
      .map(([slot]) => slot)
  }, [installers, selectedInstallers])

  function toggleInstallerSelection(id: string) {
    setMessage('')
    setSelectedInstallers(prev => {
      if (prev.includes(id)) {
        const updated = prev.filter(item => item !== id)
        if (responsibleId === id) {
          setResponsibleId(updated[0] || '')
        }
        return updated
      }
      return [...prev, id]
    })
  }

  function toggleSkill(skill: string) {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(item => item !== skill) : [...prev, skill],
    )
  }

  function handleSaveAssignment() {
    if (!objectName.trim() || !node.trim()) {
      setMessage('Укажите объект и узел, чтобы зафиксировать назначение')
      return
    }
    if (selectedInstallers.length === 0) {
      setMessage('Выберите хотя бы одного монтажника')
      return
    }

    const assignment: BrigadeAssignment = {
      id: `brigade-${Date.now()}`,
      objectName: objectName.trim(),
      region,
      node: node.trim(),
      requestedSkills: selectedSkills,
      capacity,
      window,
      installers: selectedInstallers,
      responsibleId: responsibleId || selectedInstallers[0],
      comment,
    }

    setAssignments(prev => [assignment, ...prev])
    setMessage('Назначение сохранено. Состав фиксирован для объекта.')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Бригады на объект</h1>
          <p className="text-gray-600 mt-1">
            Формирование состава из монтажников при назначении заявки, выбор ответственного и
            слота доступности.
          </p>
        </div>
        <div className="rounded-full bg-indigo-50 text-indigo-700 px-4 py-2 text-sm font-medium border border-indigo-100">
          Состав фиксируется на объекте, без постоянных карточек
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Объект и требования</h2>
                <p className="text-sm text-gray-600">Задайте узел/локацию, желаемый состав и слот</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Шаблон</label>
                <select
                  className="border border-gray-200 rounded-md px-3 py-2 text-sm"
                  onChange={event => {
                    const preset = objectPresets.find(item => item.id === event.target.value)
                    if (preset) {
                      setObjectName(`${preset.name} (${preset.address})`)
                      setNode(preset.node)
                      setRegion(preset.region)
                    }
                  }}
                >
                  <option value="">Выберите объект</option>
                  {objectPresets.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} — {preset.address}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-medium">Название объекта</label>
                <input
                  value={objectName}
                  onChange={event => setObjectName(event.target.value)}
                  placeholder="Например, ТЦ «Променада»"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-medium">Узел / адрес</label>
                <input
                  value={node}
                  onChange={event => setNode(event.target.value)}
                  placeholder="Node-21, Кутузовский пр-т 45"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-medium">Регион / кластер</label>
                <select
                  value={region}
                  onChange={event => setRegion(event.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                >
                  {['Москва', 'Санкт-Петербург', 'Нижний Новгород', 'Другой'].map(regionName => (
                    <option key={regionName} value={regionName}>
                      {regionName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-medium">Слот доступности</label>
                <select
                  value={window}
                  onChange={event => setWindow(event.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                >
                  {['Сегодня 10:00–14:00', 'Завтра 12:00–16:00', 'Пт 09:00–15:00', 'Сб 09:00–13:00'].map(slot => (
                    <option key={slot}>{slot}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-medium">Желаемый состав / слоты</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={capacity}
                    onChange={event => setCapacity(Number(event.target.value))}
                    className="w-20 border border-gray-200 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                  <span className="text-sm text-gray-600">минимум монтажников для параллельных работ</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-medium">Комментарий</label>
                <input
                  value={comment}
                  onChange={event => setComment(event.target.value)}
                  placeholder="Доступ к помещению после 12:00, нужен сварщик"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Требуемые специализации</p>
              <div className="flex flex-wrap gap-2">
                {skillOptions.map(skill => {
                  const isActive = selectedSkills.includes(skill)
                  return (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1 rounded-full text-sm border transition ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {skill}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Подбор монтажников</h2>
                <p className="text-sm text-gray-600">Выберите специалистов по региону, навыкам и доступности</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Регион</label>
                  <select
                    value={selectedRegion}
                    onChange={event => setSelectedRegion(event.target.value)}
                    className="border border-gray-200 rounded-md px-3 py-2 text-sm"
                  >
                    {regions.map(regionName => (
                      <option key={regionName} value={regionName}>
                        {regionName === 'all' ? 'Все' : regionName}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Поиск по имени или email"
                  className="border border-gray-200 rounded-md px-3 py-2 text-sm w-full md:w-64"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-gray-500">Загрузка монтажников...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredInstallers.map(installer => {
                  const isSelected = selectedInstallers.includes(installer.id)
                  return (
                    <div
                      key={installer.id}
                      className={`border rounded-lg p-3 transition hover:border-indigo-200 shadow-sm ${
                        isSelected ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{installer.full_name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              {installer.region}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{installer.email}</p>
                          <p className="text-sm text-gray-600">{installer.phone}</p>
                          <p className="text-xs text-gray-500 mt-1">Узел: {installer.node}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Активных объектов</div>
                          <div className="font-semibold text-indigo-700">
                            {installer.activeAssignments}
                          </div>
                          <div className="text-xs text-gray-500">Загрузка {installer.workload}%</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {installer.skills.map(skill => (
                          <span
                            key={skill}
                            className={`text-xs px-2 py-1 rounded-full border ${
                              selectedSkills.includes(skill)
                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                : 'border-gray-200 text-gray-700'
                            }`}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-gray-600">Доступность</p>
                        <div className="flex flex-wrap gap-1">
                          {installer.availability.map(slot => (
                            <span
                              key={slot}
                              className={`text-xs px-2 py-1 rounded-md border ${
                                commonSlots.includes(slot)
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-gray-200 text-gray-700'
                              }`}
                            >
                              {slot}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          onClick={() => toggleInstallerSelection(installer.id)}
                          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'border-gray-200 text-gray-800 hover:border-gray-300'
                          }`}
                        >
                          {isSelected ? 'Убрать из состава' : 'Добавить в состав'}
                        </button>
                        {isSelected && (
                          <button
                            onClick={() => setResponsibleId(installer.id)}
                            className={`px-3 py-2 rounded-md text-xs font-semibold border transition ${
                              responsibleId === installer.id
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            Ответственный
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {filteredInstallers.length === 0 && !isLoading && (
              <div className="py-6 text-center text-gray-500">Нет монтажников по заданным фильтрам</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Состав бригады</h3>

            <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-semibold">
                {selectedInstallers.length} монтажника
              </span>
              <span>минимум {capacity} требуются на объект</span>
            </div>

            <div className="space-y-3">
              {selectedInstallers.map(installerId => {
                const installer = installers.find(item => item.id === installerId)
                if (!installer) return null
                return (
                  <div
                    key={installer.id}
                    className="flex items-start justify-between p-3 rounded-md border border-gray-200"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{installer.full_name}</div>
                      <div className="text-xs text-gray-600">{installer.region} • {installer.node}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {installer.skills.map(skill => (
                          <span
                            key={skill}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setResponsibleId(installer.id)}
                        className={`px-3 py-2 rounded-md text-xs font-semibold border transition ${
                          responsibleId === installer.id
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        Ответственный
                      </button>
                      <button
                        onClick={() => toggleInstallerSelection(installer.id)}
                        className="p-2 text-gray-500 hover:text-red-600"
                        aria-label="Удалить из состава"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}

              {selectedInstallers.length === 0 && (
                <div className="text-sm text-gray-600">Добавьте монтажников из списка слева</div>
              )}
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-gray-800 mb-2">Совместные слоты доступности</p>
              {commonSlots.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {commonSlots.map(slot => (
                    <span
                      key={slot}
                      className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      {slot}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600">Выберите двух и более монтажников, чтобы увидеть пересечение доступности</p>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <button
                onClick={handleSaveAssignment}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700 transition"
              >
                Сохранить назначение на объект
              </button>
              {message && <p className="text-sm text-gray-700">{message}</p>}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Сохранённые назначения</h3>
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-600">Пока нет зафиксированных составов.</p>
            ) : (
              <div className="space-y-3">
                {assignments.map(assignment => (
                  <div key={assignment.id} className="p-3 rounded-md border border-gray-200">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{assignment.objectName}</p>
                        <p className="text-xs text-gray-600">
                          {assignment.region} • {assignment.node}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {assignment.installers.length} исполнителя
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Слот: {assignment.window}</p>
                    {assignment.requestedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {assignment.requestedSkills.map(skill => (
                          <span
                            key={skill}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    {assignment.comment && (
                      <p className="text-xs text-gray-700 mt-1">Комментарий: {assignment.comment}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Ответственный: {installers.find(i => i.id === assignment.responsibleId)?.full_name || 'не указан'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Политики и роли</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
              <li>
                <span className="font-semibold">Admin</span>: ведёт справочник монтажников и может править любой состав.
              </li>
              <li>
                <span className="font-semibold">Dispatcher/Operator</span>: подбирает монтажников, фиксирует ответственного и слот.
              </li>
              <li>
                <span className="font-semibold">Lead</span>: назначается из состава и может корректировать участников на своём объекте.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
