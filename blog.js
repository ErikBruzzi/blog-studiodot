/* ============================================================
   BLOG.JS — busca os posts direto do repositório GitHub e
   renderiza no navegador. Não precisa de build nem de backend:
   o painel /admin escreve os arquivos .md no repo, e esta
   página só lê o que já está lá.

   ⚠️ CONFIGURE AQUI antes de publicar:
   ============================================================ */
const BLOG_CONFIG = {
  owner: "ErikBruzzi",   // ex: "bruzziodev"
  repo: "blog-studiodot",        // ex: "studio-service"
  branch: "main",
  postsPath: "content/posts"
};

/* ---------------- Frontmatter parser (YAML simples) ---------------- */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  const [, fmBlock, body] = match;
  const data = {};
  fmBlock.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    value = value.replace(/^["']|["']$/g, "");
    data[key] = value;
  });
  return { data, content: body.trim() };
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function slugFromFilename(name) {
  return name.replace(/\.md$/, "");
}

function configIsPlaceholder() {
  return BLOG_CONFIG.owner === "SEU_USUARIO_GITHUB" || BLOG_CONFIG.repo === "SEU_REPOSITORIO";
}

/* ---------------- Fetch: lista de posts ---------------- */
async function fetchAllPosts() {
  const url = `https://api.github.com/repos/${BLOG_CONFIG.owner}/${BLOG_CONFIG.repo}/contents/${BLOG_CONFIG.postsPath}?ref=${BLOG_CONFIG.branch}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return []; // pasta ainda não existe = nenhum post publicado
    throw new Error(`GitHub API respondeu ${res.status}`);
  }
  const files = await res.json();
  const mdFiles = files.filter((f) => f.name.endsWith(".md"));

  const posts = await Promise.all(
    mdFiles.map(async (file) => {
      const raw = await (await fetch(file.download_url)).text();
      const { data } = parseFrontmatter(raw);
      return {
        slug: slugFromFilename(file.name),
        title: data.title || file.name,
        date: data.date || "",
        excerpt: data.excerpt || "",
        cover: data.cover || ""
      };
    })
  );

  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

/* ---------------- Fetch: post único ---------------- */
async function fetchPost(slug) {
  const url = `https://raw.githubusercontent.com/${BLOG_CONFIG.owner}/${BLOG_CONFIG.repo}/${BLOG_CONFIG.branch}/${BLOG_CONFIG.postsPath}/${slug}.md`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Post não encontrado");
  const raw = await res.text();
  return parseFrontmatter(raw);
}

/* ---------------- Render: lista (blog/index.html) ---------------- */
async function renderBlogList() {
  const grid = document.getElementById("blog-list");
  if (!grid) return;

  if (configIsPlaceholder()) {
    grid.innerHTML = `<div class="blog-state">
      O blog ainda não foi configurado — falta preencher <code>owner</code> e <code>repo</code> em <strong>blog/blog.js</strong>.
    </div>`;
    return;
  }

  grid.innerHTML = `<div class="blog-state">Carregando posts...</div>`;

  try {
    const posts = await fetchAllPosts();
    if (posts.length === 0) {
      grid.innerHTML = `<div class="blog-state">Nenhum post publicado ainda. Assim que você publicar pelo painel /admin, ele aparece aqui.</div>`;
      return;
    }
    grid.innerHTML = posts.map(postCardHTML).join("");
  } catch (err) {
    grid.innerHTML = `<div class="blog-state">Não consegui carregar os posts agora. Tente recarregar a página.</div>`;
    console.error(err);
  }
}

function postCardHTML(post) {
  const cover = post.cover
    ? `<div class="post-cover-wrap"><img src="${post.cover}" alt="${escapeHTML(post.title)}" loading="lazy"></div>`
    : "";
  return `
    <a class="post-card" href="post.html?slug=${encodeURIComponent(post.slug)}">
      ${cover}
      <div class="post-body">
        <span class="post-date">${formatDate(post.date)}</span>
        <h2>${escapeHTML(post.title)}</h2>
        <p>${escapeHTML(post.excerpt)}</p>
        <span class="read-more">Ler post →</span>
      </div>
    </a>`;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* ---------------- Render: post único (blog/post.html) ---------------- */
async function renderSinglePost() {
  const container = document.getElementById("post-container");
  if (!container) return;

  const slug = new URLSearchParams(window.location.search).get("slug");
  if (!slug) {
    container.innerHTML = `<div class="blog-state">Post não especificado.</div>`;
    return;
  }
  if (configIsPlaceholder()) {
    container.innerHTML = `<div class="blog-state">
      O blog ainda não foi configurado — falta preencher <code>owner</code> e <code>repo</code> em <strong>blog/blog.js</strong>.
    </div>`;
    return;
  }

  container.innerHTML = `<div class="blog-state">Carregando post...</div>`;

  try {
    const { data, content } = await fetchPost(slug);
    document.title = `${data.title || "Post"} — Blog studio.`;

    const coverHTML = data.cover ? `<img class="post-cover" src="${data.cover}" alt="${escapeHTML(data.title)}">` : "";
    const bodyHTML = window.marked ? marked.parse(content) : `<p>${escapeHTML(content)}</p>`;

    container.innerHTML = `
      <div class="wrap post-header">
        <a class="back-link" href="index.html">← Voltar pro blog</a>
        <span class="post-date">${formatDate(data.date)}</span>
        <h1 class="post-title">${escapeHTML(data.title)}</h1>
      </div>
      <div class="wrap">
        ${coverHTML}
        <div class="post-content">${bodyHTML}</div>
      </div>`;
  } catch (err) {
    container.innerHTML = `<div class="blog-state">Não encontrei esse post. <a href="index.html">Voltar pro blog</a>.</div>`;
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  renderBlogList();
  renderSinglePost();
});
