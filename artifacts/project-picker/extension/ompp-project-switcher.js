import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PROJECTS_FILE = path.join(os.homedir(), '.config', 'cmux', 'projects.json');

function loadProjects() {
  const raw = fs.readFileSync(PROJECTS_FILE, 'utf8');
  const data = JSON.parse(raw);
  return (data.projects || [])
    .filter((project) => project && project.name && project.path && fs.existsSync(project.path));
}

function formatProjects(projects) {
  return projects
    .map((project, index) => `${String(index + 1).padStart(2, ' ')}. ${project.name}  ${project.path}`)
    .join('\n');
}

function resolveProject(args, projects) {
  const token = String(args || '').trim();
  if (!token) return null;

  if (/^\d+$/.test(token)) {
    const index = Number(token) - 1;
    return projects[index] || null;
  }

  const expanded = token.startsWith('~') ? path.join(os.homedir(), token.slice(1)) : token;
  if (path.isAbsolute(expanded) && fs.existsSync(expanded)) {
    return { name: path.basename(expanded), path: expanded };
  }

  const needle = token.toLowerCase();
  const matches = projects.filter((project) =>
    project.name.toLowerCase().includes(needle) || project.path.toLowerCase().includes(needle)
  );
  return matches.length === 1 ? matches[0] : null;
}

async function moveSession(ctx, project) {
  const manager = ctx.sessionManager;
  if (manager && typeof manager.moveTo === 'function') {
    await ctx.waitForIdle();
    await manager.moveTo(project.path);
    await ctx.reload();
    ctx.ui?.notify?.(`Switched OMP to ${project.name}`, 'success');
    return;
  }

  ctx.ui?.notify?.(`Cannot switch directly in this OMP build. Run: /move ${project.path}`, 'warning');
}

export default function omppProjectSwitcher(pi) {
  pi.setLabel('OMP Project Picker');

  pi.registerCommand('ompp', {
    description: 'List or switch to a CMUX project by number, name, or path',
    handler: async (args, ctx) => {
      let projects;
      try {
        projects = loadProjects();
      } catch (error) {
        ctx.ui?.notify?.(`Could not read ${PROJECTS_FILE}: ${error.message}`, 'error');
        return;
      }

      if (!String(args || '').trim()) {
        ctx.ui?.notify?.(`Use /ompp <number|name|path>\n\n${formatProjects(projects)}`, 'info');
        return;
      }

      const project = resolveProject(args, projects);
      if (!project) {
        ctx.ui?.notify?.(`No unique project match for: ${args}\n\n${formatProjects(projects)}`, 'error');
        return;
      }

      await moveSession(ctx, project);
    },
  });
}
