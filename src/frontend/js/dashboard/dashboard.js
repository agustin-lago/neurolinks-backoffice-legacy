/* global Chart */
// dashboard.js - Logica del Dashboard de Performance

const _dashToken = localStorage.getItem('backoffice_token');
let _dashCharts = {};
let _dashInterval = null;

async function _loadDashboardData() {
    try {
        const hasRenderedStats = !document.getElementById('last-update')?.classList.contains('hidden');
        if (!hasRenderedStats && typeof window.Skeleton !== 'undefined') {
            const kpiIds = ['kpi-conversion', 'kpi-msgs', 'kpi-bot', 'kpi-resp'];
            kpiIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = `<div class="skeleton-title" style="width: 60%; height: 32px; margin: 0; border-radius: 6px;"></div>`;
            });
        }
        const url = _dashToken ? `/api/dashboard/stats?token=${_dashToken}` : `/api/dashboard/stats`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        _renderDashStats(data.stats);

        const aiUrl = _dashToken ? `/api/dashboard/openai-usage?token=${_dashToken}` : `/api/dashboard/openai-usage`;
        const aiRes = await fetch(aiUrl);
        const aiData = await aiRes.json();
        if (aiData.success) _createDashChart('chart-openai', 'line', aiData.data, ['#10b981'], {
            datasetLabel: 'USD',
            fill: true,
            legend: false,
            tension: 0.35
        });
    } catch (e) {
        console.error('Error cargando KPIs:', e);
    }
}

function _renderDashStats(stats) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpi-conversion', stats.conversionRate + '%');
    set('kpi-msgs', stats.msgCountLast24h);
    set('kpi-bot', stats.proactivity + '%');
    set('kpi-resp', stats.avgResponseTime + 'm');

    const lu = document.getElementById('last-update');
    if (lu) {
        lu.textContent = 'Actualizado: ' + new Date().toLocaleTimeString();
        lu.classList.remove('hidden');
    }

    _createDashChart('chart-funnel', 'bar', stats.funnel, ['#10b981', '#f59e0b', '#ef4444', '#0078D4', '#8b5cf6'], {
        datasetLabel: 'Leads',
        indexAxis: 'y',
        legend: false,
        maxBarThickness: 14,
        minBarLength: 4,
        sort: 'desc'
    });
    _createDashChart('chart-categories', 'bar', stats.categories, ['#0078D4'], {
        datasetLabel: 'Consultas',
        indexAxis: 'y',
        legend: false,
        sort: 'desc'
    });
    _createDashChart('chart-productivity', 'bar', stats.productivity, ['#8b5cf6'], {
        datasetLabel: 'Acciones',
        indexAxis: 'y',
        legend: false,
        sort: 'desc'
    });
    _createDashChart('chart-sources', 'doughnut', stats.sources, ['#0078D4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], {
        cutout: '62%'
    });
}

function _prepareDashData(dataMap, options = {}) {
    const entries = Object.entries(dataMap || {})
        .map(([label, value]) => ({
            label: label && label !== 'undefined' ? label : 'Sin datos',
            value: Number(value) || 0
        }))
        .filter(item => item.label);

    if (options.sort === 'desc') entries.sort((a, b) => b.value - a.value);

    const hasData = entries.some(item => item.value > 0);
    const rows = hasData ? entries : [{ label: 'Sin datos', value: 1 }];

    return {
        labels: rows.map(item => item.label),
        values: rows.map(item => item.value),
        hasData
    };
}

function _truncateDashLabel(label, max = 24) {
    return label.length > max ? `${label.slice(0, max - 1)}...` : label;
}

function _createDashChart(id, type, dataMap, colors = [], chartOptions = {}) {
    if (_dashCharts[id]) { _dashCharts[id].destroy(); delete _dashCharts[id]; }
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { labels, values, hasData } = _prepareDashData(dataMap, chartOptions);
    const bg = hasData
        ? (colors.length ? colors : ['#0078D4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'])
        : ['rgba(148, 163, 184, 0.28)'];
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const borderColor = hasData ? (colors[0] || '#0078D4') : 'rgba(148, 163, 184, 0.45)';
    const lineFill = ctx.createLinearGradient(0, 0, 0, canvas.parentElement?.clientHeight || 320);
    lineFill.addColorStop(0, isDark ? 'rgba(16,185,129,0.26)' : 'rgba(16,185,129,0.18)');
    lineFill.addColorStop(1, 'rgba(16,185,129,0)');

    const isBar = type === 'bar';
    const isHorizontalBar = isBar && chartOptions.indexAxis === 'y';
    const isLine = type === 'line';
    const showLegend = chartOptions.legend !== false && !isBar && hasData;

    const dataset = {
        label: chartOptions.datasetLabel || '',
        data: values,
        backgroundColor: isLine ? lineFill : bg,
        borderColor: isLine ? borderColor : 'transparent',
        borderWidth: isLine ? 2 : 0,
        borderRadius: isBar ? 8 : 0,
        borderSkipped: false,
        fill: Boolean(chartOptions.fill),
        hoverOffset: isBar ? 0 : 8,
        maxBarThickness: chartOptions.maxBarThickness || (isHorizontalBar ? 28 : 44),
        minBarLength: chartOptions.minBarLength || 0,
        pointBackgroundColor: borderColor,
        pointBorderColor: isDark ? '#0b2236' : '#ffffff',
        pointRadius: isLine ? 4 : 0,
        pointHoverRadius: isLine ? 6 : 0,
        tension: chartOptions.tension || 0
    };

    const cartesianScales = isBar || isLine
        ? {
            x: {
                beginAtZero: !isLine || isHorizontalBar,
                ticks: {
                    color: textColor,
                    autoSkip: false,
                    font: { family: 'Poppins', size: 11 },
                    callback(value) {
                        if (isHorizontalBar) return value;
                        const label = this.getLabelForValue(value);
                        return _truncateDashLabel(label, 16);
                    },
                    maxRotation: 0
                },
                grid: { color: isHorizontalBar ? gridColor : 'transparent' }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: textColor,
                    font: { family: 'Poppins', size: 11 },
                    callback(value) {
                        if (!isHorizontalBar) return value;
                        return _truncateDashLabel(this.getLabelForValue(value));
                    }
                },
                grid: { color: isHorizontalBar ? 'transparent' : gridColor }
            }
        }
        : {};

    _dashCharts[id] = new Chart(ctx, {
        type,
        data: { labels, datasets: [dataset] },
        options: {
            animation: { duration: 450 },
            indexAxis: chartOptions.indexAxis || 'x',
            interaction: { intersect: false, mode: 'nearest' },
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 6 },
            plugins: {
                legend: {
                    display: showLegend,
                    position: 'bottom',
                    labels: {
                        boxWidth: 10,
                        color: textColor,
                        padding: 14,
                        usePointStyle: true,
                        font: { family: 'Poppins', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(10, 25, 47, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                    borderColor: isDark ? 'rgba(0, 153, 255, 0.25)' : 'rgba(0, 120, 212, 0.18)',
                    borderWidth: 1,
                    bodyColor: isDark ? '#e5edf7' : '#334155',
                    displayColors: true,
                    padding: 10,
                    titleColor: isDark ? '#ffffff' : '#0f172a',
                    titleFont: { family: 'Poppins', weight: 700 },
                    bodyFont: { family: 'Poppins' }
                }
            },
            scales: cartesianScales,
            cutout: chartOptions.cutout
        }
    });
}

function _onDashThemeChange() {
    Object.keys(_dashCharts).forEach(k => { if (_dashCharts[k]) _dashCharts[k].destroy(); delete _dashCharts[k]; });
    _loadDashboardData();
}

window.initDashboardView = function() {
    if (_dashInterval) { clearInterval(_dashInterval); _dashInterval = null; }
    Object.keys(_dashCharts).forEach(k => { if (_dashCharts[k]) _dashCharts[k].destroy(); });
    _dashCharts = {};
    window.removeEventListener('themeChanged', _onDashThemeChange);
    window.addEventListener('themeChanged', _onDashThemeChange);
    _loadDashboardData();
    _dashInterval = setInterval(_loadDashboardData, 60000);
};

window.destroyDashboardView = function() {
    if (_dashInterval) { clearInterval(_dashInterval); _dashInterval = null; }
    window.removeEventListener('themeChanged', _onDashThemeChange);
};
