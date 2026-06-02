/**
 * VeloraPing Enterprise  - Monolithic Single-File Core
 * Author: @PersiaHub (https://github.com/PersiaHub)
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ping = require('ping');
const tcpPing = require('tcp-ping');

const app = express();
app.use(cors());
app.use(express.json());

// 1. HTML Dashboard Core Interface
const HTML_INTERFACE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VeloraPing  Gateway</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background: radial-gradient(circle at top right, #1e293b, #0f172a, #020617); }</style>
</head>
<body class="text-slate-200 antialiased min-h-screen flex flex-col justify-center items-center p-4">
    <div class="w-full max-w-3xl bg-[#121824]/75 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-6 md:p-8" id="main-container">
        <header class="mb-8">
            <h1 class="text-2xl font-black text-white tracking-tight">VeloraPing </h1>
            <p class="text-xs text-slate-400 mt-1">Diagnostic gateway for tracking Host Pings and TCP Ports.</p>
        </header>

        <div class="space-y-4 mb-6">
            <div class="flex flex-col sm:flex-row gap-3">
                <input type="text" id="target-host" class="flex-[3] bg-[#0f1420]/90 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Domain / IP (e.g. 8.8.8.8) or URL">
                <input type="number" id="target-port" class="flex-[1] bg-[#0f1420]/90 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Port (Optional)">
                <button onclick="triggerDiagnostic()" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl px-6 py-3 transition-all" id="btn-text">Run Diagnostics</button>
            </div>
        </div>

        <div id="result-card" class="hidden border border-slate-800/60 bg-[#0d121f]/90 rounded-2xl p-6">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div><span class="block text-[11px] font-bold uppercase text-slate-500">Target Host</span><span id="res-host" class="block text-sm font-mono text-slate-300 mt-2 truncate">--</span></div>
                <div><span class="block text-[11px] font-bold uppercase text-slate-500">Status</span><span id="res-status" class="inline-block text-xs font-bold px-2.5 py-1 rounded-full mt-2">--</span></div>
                <div><span class="block text-[11px] font-bold uppercase text-slate-500">Latency</span><span id="res-ping" class="block text-xl font-black text-blue-400 mt-1">--</span></div>
                <div><span class="block text-[11px] font-bold uppercase text-slate-500">Network Code</span><span id="res-code" class="block text-sm font-mono text-amber-400 mt-2">--</span></div>
            </div>
        </div>

        <footer class="mt-8 pt-4 border-t border-slate-800/40 flex justify-between items-center text-[11px] font-mono text-slate-500">
            <div>Engine Status: Operational</div>
            <div>Core Architect: <a href="https://github.com/PersiaHub" target="_blank" class="text-blue-400 font-bold hover:underline">@PersiaHub</a></div>
        </footer>
    </div>

    <script>
        async function triggerDiagnostic() {
            const target = document.getElementById('target-host').value.trim();
            const port = document.getElementById('target-port').value.trim();
            if (!target) return alert('Target cannot be empty.');

            document.getElementById('result-card').classList.remove('hidden');
            document.getElementById('res-status').innerText = 'Analyzing...';

            try {
                const response = await fetch('/api/ping', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target, port: port || null })
                });
                const data = await response.json();
                if (data.success) {
                    document.getElementById('res-host').innerText = data.port ? \`\${data.host}:\${data.port}\` : data.host;
                    document.getElementById('res-ping').innerText = data.ping;
                    document.getElementById('res-code').innerText = data.statusCode;
                    document.getElementById('res-status').innerText = data.online ? 'ONLINE' : 'BLOCKED';
                    document.getElementById('res-status').className = data.online ? "bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-full mt-2" : "bg-rose-500/10 text-rose-400 text-xs font-bold px-2.5 py-1 rounded-full mt-2";
                }
            } catch (e) { document.getElementById('res-status').innerText = 'ERROR'; }
        }
    </script>
</body>
</html>
`;

// 2. Serve Web UI
app.get('/', (req, res) => {
    res.send(HTML_INTERFACE);
});

// 3. Network API Endpoint
app.post('/api/ping', async (req, res) => {
    let { target, port } = req.body;
    const cleanHost = target.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].split(':')[0];

    if (port) {
        tcpPing.ping({ address: cleanHost, port: parseInt(port, 10), timeout: 3000, attempts: 1 }, (err, data) => {
            const open = !err && !isNaN(data.avg);
            return res.json({ success: true, host: cleanHost, port, online: open, ping: open ? `${Math.round(data.avg)}ms` : 'Filtered', statusCode: open ? 'PORT_OPEN' : 'PORT_BLOCKED' });
        });
        return;
    }

    if (target.startsWith('http://') || target.startsWith('https://')) {
        const start = Date.now();
        try {
            const response = await axios.get(target, { timeout: 4000 });
            return res.json({ success: true, host: cleanHost, online: true, ping: `${Date.now() - start}ms`, statusCode: response.status });
        } catch (httpError) {
            return res.json({ success: true, host: cleanHost, online: !!httpError.response, ping: `${Date.now() - start}ms`, statusCode: httpError.response ? httpError.response.status : 'DOWN' });
        }
    }

    const pingResponse = await ping.promise.probe(cleanHost, { timeout: 4 });
    return res.json({ success: true, host: cleanHost, online: pingResponse.alive, ping: pingResponse.alive ? `${Math.round(parseFloat(pingResponse.time))}ms` : 'Timeout', statusCode: pingResponse.alive ? 'ICMP_REPLY' : 'NO_RESPONSE' });
});

// 4. Dynamic Port Listener (موقع نصب هر پورتی داده شود، روی همان روشن می‌شود)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[VelorarPing] Operational on port ${PORT}`);
});