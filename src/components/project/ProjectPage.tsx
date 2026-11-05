import type { LucideIcon } from 'lucide-react';
import {
  Bug, CheckCircle2, CircleDashed, Cloud, Code2, Database, Gauge, Github, ImageOff, KeyRound,
  Layers, Map, Paintbrush, PlugZap, Rocket, ShieldCheck, Sparkles, Users, Wrench,
} from 'lucide-react';
import logo from '../../assets/logo.png';

const AUTORA = 'Gabriela Garcia';
const REPO_URL = 'https://github.com/gabrriela07/capsula_sonora_caseira';

interface BugItem { icon: LucideIcon; title: string; problem: string; fix: string }
interface RoadmapItem { title: string; detail: string; status: 'done' | 'next' | 'idea' }

const bugs: BugItem[] = [
  { icon: PlugZap, title: 'União da API com o site', problem: 'Site e API rodavam em terminais separados; com a API parada, o painel quebrava.', fix: 'Um único npm run dev sobe API e site juntos com concurrently.' },
  { icon: KeyRound, title: 'Erro de chave do Last.fm', problem: 'O painel voltava para a tela inicial com aviso de VITE_LASTFM_API_KEY.', fix: 'Causa real era a API sem responder (ECONNRESET); variáveis do site e do servidor separadas e documentadas.' },
  { icon: Gauge, title: 'Demora no carregamento', problem: 'Primeira abertura lenta e consultas pesadas a cada filtro.', fix: 'Sincronização incremental, cache de durações e gêneros e filtros com debounce.' },
  { icon: ImageOff, title: 'Imagens que não carregavam', problem: 'Capas e fotos vazias no dashboard, hovers e one page.', fix: 'Busca em cascata: histórico → Last.fm → MusicBrainz/Cover Art → cache → arte gerada.' },
  { icon: Layers, title: 'Hovers atrás dos cards', problem: 'Tooltips cortados ou escondidos pelos cards vizinhos.', fix: 'Hovers renderizados em portal, sempre acima da página.' },
  { icon: Map, title: 'Mapa com poucos artistas', problem: 'Só 4 artistas tinham localização encontrada.', fix: 'Substituído pela Galáxia da sua escuta, sem depender de geolocalização.' },
  { icon: Code2, title: 'Build quebrado no deploy', problem: 'Erros de TypeScript (TS2741 e TS18047) travavam o Render.', fix: 'Props e tipagem corrigidas; build validado antes de cada push.' },
];

const roadmap: RoadmapItem[] = [
  { title: 'Página inicial', detail: 'Dashboard com KPIs, favoritos, evolução, ritmos, descobertas e fluxo da escuta.', status: 'done' },
  { title: 'Last.fm one page', detail: 'Mosaico de artistas, álbuns e faixas, com exportação da página inteira.', status: 'done' },
  { title: 'Usuário dinâmico', detail: 'Cada pessoa abre a própria cápsula pelo link ?user=.', status: 'done' },
  { title: 'Publicação via Render', detail: 'Site e API no ar, com banco MySQL na nuvem (Aiven).', status: 'next' },
  { title: 'README e vídeo de apresentação', detail: 'Repositório documentado para outras pessoas usarem.', status: 'next' },
  { title: 'Novas visões', detail: 'Comparação entre usuários e retrospectiva anual automática.', status: 'idea' },
];

const statusStyle = {
  done: { label: 'Concluído', icon: CheckCircle2, chip: 'bg-slime/10 text-slime', dot: 'bg-slime' },
  next: { label: 'Próximo', icon: Rocket, chip: 'bg-banana/10 text-banana', dot: 'bg-banana' },
  idea: { label: 'Ideia', icon: CircleDashed, chip: 'bg-petal/10 text-petal', dot: 'bg-petal' },
} as const;

const stack = ['React', 'TypeScript', 'Vite', 'Tailwind', 'Recharts', 'DuckDB-WASM', 'Node.js', 'Express', 'MySQL', 'Last.fm API'];

export function ProjectPage() {
  const concluidos = roadmap.filter((item) => item.status === 'done').length;
  const progresso = Math.round((concluidos / roadmap.length) * 100);

  return <div className="space-y-8">
    {/* Hero */}
    <section className="panel relative overflow-hidden">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-slime/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
        <img src={logo} alt="Logo da Cápsula Sonora" className="h-24 w-auto shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-slime">sobre o projeto</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Cápsula Sonora</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Seu histórico do Last.fm transformado em uma cápsula do tempo musical: rankings, ritmos, descobertas e conexões entre artistas em um painel interativo.</p>
          <div className="mt-4 flex flex-wrap gap-2">{stack.map((item) => <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">{item}</span>)}</div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 md:w-56">
          <div className="rounded-2xl bg-carbon/60 p-4 text-center"><p className="text-2xl font-extrabold text-slime">{bugs.length}</p><p className="text-[11px] text-zinc-500">bugs corrigidos</p></div>
          <div className="rounded-2xl bg-carbon/60 p-4 text-center"><p className="text-2xl font-extrabold text-banana">{progresso}%</p><p className="text-[11px] text-zinc-500">do roadmap</p></div>
        </div>
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      {/* Bugs */}
      <section className="panel">
        <div className="mb-5 flex items-center gap-2"><Bug className="h-5 w-5 text-petal" /><h3 className="text-lg font-bold">Bugs corrigidos</h3></div>
        <ul className="space-y-3">
          {bugs.map(({ icon: Icon, title, problem, fix }) => <li key={title} className="group rounded-2xl border border-white/5 bg-carbon/45 p-4 transition hover:border-slime/30 hover:bg-carbon/70">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slime/10 text-slime"><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{title}</p><span className="rounded-full bg-slime/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slime">corrigido</span></div>
                <p className="mt-1 text-xs text-zinc-500"><span className="font-semibold text-zinc-400">Problema:</span> {problem}</p>
                <p className="mt-1 text-xs text-zinc-300"><Wrench className="mr-1 inline h-3 w-3 text-slime" />{fix}</p>
              </div>
            </div>
          </li>)}
        </ul>
      </section>

      {/* Roadmap */}
      <section className="panel">
        <div className="mb-2 flex items-center gap-2"><Rocket className="h-5 w-5 text-banana" /><h3 className="text-lg font-bold">Roadmap</h3></div>
        <div className="mb-6 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-slime to-banana transition-all" style={{ width: `${progresso}%` }} /></div>
        <ol className="relative space-y-5 border-l border-white/10 pl-6">
          {roadmap.map((item) => {
            const s = statusStyle[item.status];
            const Icon = s.icon;
            return <li key={item.title} className="relative">
              <span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-[#1b1b1d] ${s.dot}`} />
              <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.title}</p><span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${s.chip}`}><Icon className="h-3 w-3" />{s.label}</span></div>
              <p className="mt-1 text-xs text-zinc-400">{item.detail}</p>
              {item.title === 'Publicação via Render' && <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500"><Cloud className="h-3 w-3" /> Render (site + API) · <Database className="h-3 w-3" /> Aiven (MySQL)</p>}
            </li>;
          })}
        </ol>
      </section>
    </div>

    {/* Autoria e propriedade intelectual */}
    <section className="panel border-petal/20">
      <div className="mb-5 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-petal" /><h3 className="text-lg font-bold">Autoria e propriedade intelectual</h3></div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-carbon/45 p-4">
          <Sparkles className="mb-2 h-5 w-5 text-slime" />
          <p className="font-bold">Ideia e conceito</p>
          <p className="mt-1 text-xs text-zinc-400">A ideia, o conceito e a concepção da Cápsula Sonora foram criados por <strong className="text-zinc-200">{AUTORA}</strong>, a quem pertence toda a propriedade intelectual do projeto.</p>
        </div>
        <div className="rounded-2xl bg-carbon/45 p-4">
          <Paintbrush className="mb-2 h-5 w-5 text-banana" />
          <p className="font-bold">Identidade visual</p>
          <p className="mt-1 text-xs text-zinc-400">O logotipo da Cápsula Sonora é uma criação original de <strong className="text-zinc-200">{AUTORA}</strong>, desenhado à mão no Microsoft Paint, sem uso de bancos de imagem ou geradores automáticos.</p>
        </div>
        <div className="rounded-2xl bg-carbon/45 p-4">
          <Users className="mb-2 h-5 w-5 text-petal" />
          <p className="font-bold">Uso e créditos</p>
          <p className="mt-1 text-xs text-zinc-400">Ao usar ou adaptar o projeto, mantenha os créditos à autora. Dados musicais fornecidos pelo Last.fm e MusicBrainz; projeto independente, sem afiliação com essas plataformas.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} {AUTORA} · Cápsula Sonora. Todos os direitos sobre a ideia e a identidade visual reservados.</p>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-semibold text-slime transition hover:text-white"><Github className="h-4 w-4" /> /gabrriela07</a>
      </div>
    </section>
  </div>;
}
