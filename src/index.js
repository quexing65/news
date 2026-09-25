export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 初始化数据库表
    if (path === '/api/init' && request.method === 'POST') {
      await env.DB.exec(`CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT DEFAULT '匿名',
        category TEXT DEFAULT '未分类',
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );`);
      return jsonResponse({ success: true, message: '数据库初始化成功' });
    }

    // API 路由
    if (path.startsWith('/api/')) {
      return handleApi(request, env, path);
    }

    // 前端页面
    return new Response(renderHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
};

async function handleApi(request, env, path) {
  const method = request.method;

  // 获取文章列表
  if (path === '/api/articles' && method === 'GET') {
    const result = await env.DB.prepare('SELECT * FROM articles ORDER BY created_at DESC').all();
    return jsonResponse(result.results);
  }

  // 获取单篇文章
  if (path.startsWith('/api/articles/') && method === 'GET') {
    const id = path.split('/')[3];
    const result = await env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
    if (!result) return jsonResponse({ error: '文章不存在' }, 404);
    return jsonResponse(result);
  }

  // 创建文章
  if (path === '/api/articles' && method === 'POST') {
    const body = await request.json();
    if (!body.title || !body.content) {
      return jsonResponse({ error: '标题和内容不能为空' }, 400);
    }
    const result = await env.DB.prepare(
      'INSERT INTO articles (title, content, author, category, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      body.title,
      body.content,
      body.author || '匿名',
      body.category || '未分类',
      body.status || 'draft'
    ).run();
    return jsonResponse({ success: true, id: result.meta.last_row_id });
  }

  // 更新文章
  if (path.startsWith('/api/articles/') && method === 'PUT') {
    const id = path.split('/')[3];
    const body = await request.json();
    const result = await env.DB.prepare(
      `UPDATE articles SET title = ?, content = ?, author = ?, category = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(
      body.title,
      body.content,
      body.author || '匿名',
      body.category || '未分类',
      body.status || 'draft',
      id
    ).run();
    if (result.meta.changes === 0) return jsonResponse({ error: '文章不存在' }, 404);
    return jsonResponse({ success: true });
  }

  // 删除文章
  if (path.startsWith('/api/articles/') && method === 'DELETE') {
    const id = path.split('/')[3];
    const result = await env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
    if (result.meta.changes === 0) return jsonResponse({ error: '文章不存在' }, 404);
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: '未找到' }, 404);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>新闻管理系统</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { margin-bottom: 20px; color: #1a1a1a; }
    .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-danger { background: #dc2626; color: #fff; }
    .btn-danger:hover { background: #b91c1c; }
    .btn-edit { background: #059669; color: #fff; }
    .btn-edit:hover { background: #047857; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }
    .article-list {
