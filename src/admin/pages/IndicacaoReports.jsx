import { useState, useEffect } from 'react'
import { BarChart3, Download, Calendar, Filter, DollarSign, MousePointerClick, Users, TrendingUp } from 'lucide-react'
import api from '../../services/api'

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function IndicacaoReports() {
    const [report, setReport] = useState({ summary: {}, affiliates: [] })
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [affiliateId, setAffiliateId] = useState('')
    const [affiliatesList, setAffiliatesList] = useState([])
    const [exporting, setExporting] = useState(false)

    useEffect(() => {
        loadAffiliatesList()
        loadReport()
    }, [])

    const loadAffiliatesList = async () => {
        try {
            const { data } = await api.get('/admin/indicadores')
            setAffiliatesList(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error('Error loading affiliates list:', err)
        }
    }

    const loadReport = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)
            if (affiliateId) params.append('affiliateId', affiliateId)

            const { data } = await api.get(`/admin/indicacao-reports?${params.toString()}`)
            setReport(data || { summary: {}, affiliates: [] })
        } catch (err) {
            console.error('Error loading report:', err)
        } finally {
            setLoading(false)
        }
    }

    const exportCSV = async () => {
        setExporting(true)
        try {
            const params = new URLSearchParams()
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)
            if (affiliateId) params.append('affiliateId', affiliateId)

            const response = await api.get(`/admin/indicacao-reports/export?${params.toString()}`, {
                responseType: 'blob'
            })

            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', 'relatorio-indicadores.csv')
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Error exporting CSV:', err)
            alert('Erro ao exportar relatorio')
        } finally {
            setExporting(false)
        }
    }

    const summary = report.summary || {}

    const summaryCards = [
        { label: 'Total Comissoes', value: formatCurrency(summary.totalCommissions || 0), icon: DollarSign, color: 'bg-green-50 text-green-600' },
        { label: 'Total Payouts', value: formatCurrency(summary.totalPayouts || 0), icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
        { label: 'Total Cliques', value: summary.totalClicks || 0, icon: MousePointerClick, color: 'bg-purple-50 text-purple-600' },
        { label: 'Taxa de Conversao', value: `${summary.conversionRate || '0.0'}%`, icon: Users, color: 'bg-amber-50 text-amber-600' }
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6" />
                        Relatorios de Indicadores
                    </h1>
                    <p className="text-slate-500">Analise o desempenho dos indicadores</p>
                </div>
                <button
                    onClick={exportCSV}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                    <Download className="w-4 h-4" />
                    {exporting ? 'Exportando...' : 'Exportar CSV'}
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Filtros</span>
                </div>
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Data Inicio</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Data Fim</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Indicador</label>
                        <select
                            value={affiliateId}
                            onChange={e => setAffiliateId(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
                        >
                            <option value="">Todos os indicadores</option>
                            {affiliatesList.map(a => (
                                <option key={a.id} value={a.id}>{a.name || a.email}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={loadReport}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
                    >
                        Filtrar
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {summaryCards.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
                                <Icon className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="text-lg font-bold text-slate-900">{value}</p>
                    </div>
                ))}
            </div>

            {/* Report Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (report.affiliates || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <BarChart3 className="w-12 h-12 mb-2" />
                        <p>Nenhum dado encontrado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Cliques</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Conversoes</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Taxa</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Comissoes</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Payouts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {report.affiliates.map(affiliate => {
                                    const clicks = parseInt(affiliate.clicks) || 0
                                    const conversions = parseInt(affiliate.conversions) || 0
                                    const rate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : '0.0'
                                    return (
                                        <tr key={affiliate.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-4 text-sm font-medium text-slate-900">{affiliate.name || '-'}</td>
                                            <td className="px-4 py-4 text-sm text-slate-600">{affiliate.email}</td>
                                            <td className="px-4 py-4 text-sm text-right text-slate-600">{clicks}</td>
                                            <td className="px-4 py-4 text-sm text-right text-slate-600">{conversions}</td>
                                            <td className="px-4 py-4 text-sm text-right text-slate-600">{rate}%</td>
                                            <td className="px-4 py-4 text-sm text-right font-medium text-green-700">
                                                {formatCurrency(affiliate.total_commissions || 0)}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-right font-medium text-blue-700">
                                                {formatCurrency(affiliate.total_payouts || 0)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
