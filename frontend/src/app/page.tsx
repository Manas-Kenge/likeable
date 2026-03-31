'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputSubmit,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader } from '@/components/ai-elements/loader';

import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';

import { GlobeIcon } from 'lucide-react';
import { api, type Project } from '@/lib/api';

const SUGGESTIONS = [
  'Create a responsive navbar with Tailwind CSS',
  'Build a todo app with React',
  'Make a landing page for a coffee shop',
  'Add a dark mode toggle',
];

const NewChatPage = () => {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Load existing projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await api.getProjects();
        if (response.success && response.data) {
          setProjects(response.data);
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, []);

  const handleSubmit = async (message: PromptInputMessage) => {
    if (!message.text?.trim() || isCreating) return;

    setIsCreating(true);

    try {
      // Create a new project with the initial prompt
      const response = await api.createProject({
        name: message.text.slice(0, 50), // Use first 50 chars as project name
        description: message.text,
        initialPrompt: message.text,
      });

      if (response.success && response.data) {
        // Store prompt in sessionStorage for immediate display on chat page
        sessionStorage.setItem('pendingPrompt', message.text);
        // Navigate to the chat page with the new project ID
        router.push(`/chat/${response.data.id}`);
      } else {
        console.error('Failed to create project:', response.error);
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      setIsCreating(false);
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/chat/${projectId}`);
  };

  const activeProjects = projects.filter(
    (project) => project.status === "running" || project.status === "creating",
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/clouds.jpg')] bg-cover bg-[center_30%] bg-no-repeat bg-scroll md:bg-fixed"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,15,37,0.68)_0%,rgba(20,67,130,0.28)_28%,rgba(239,244,251,0.18)_56%,rgba(248,250,252,0.92)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-slate-950/35 via-slate-900/10 to-transparent"
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* TOPBAR */}
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center px-2">
            <span className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              Likeable
            </span>
          </div>
        </div>

        {/* CENTERED PROMPT */}
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="w-full max-w-4xl">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-8 space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.32em] text-sky-100/80">
                  Shape the next project
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  What can we build together?
                </h1>
                <p className="mx-auto max-w-xl text-sm leading-6 text-slate-100/82 sm:text-base">
                  Describe your idea and I&apos;ll turn the cloudy canvas into
                  a clear starting point with the right structure, tooling, and
                  next steps.
                </p>
              </div>

              <div className="mb-6">
                <Suggestions className="gap-3 pb-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <Suggestion
                      key={suggestion}
                      className="h-10 border-white/55 bg-white/90 px-4 text-slate-700 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.85)] hover:bg-white hover:text-slate-900"
                      suggestion={suggestion}
                      onClick={(s) => setInput(s)}
                    />
                  ))}
                </Suggestions>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-white/65 bg-white/92 shadow-[0_28px_70px_-28px_rgba(15,23,42,0.75)]">
                <PromptInput
                  className="bg-transparent"
                  onSubmit={handleSubmit}
                  globalDrop
                  multiple
                >
                  <PromptInputHeader />

                  <PromptInputBody>
                    <PromptInputTextarea
                      onChange={(e) => setInput(e.target.value)}
                      value={input}
                      placeholder="Describe what you want to build..."
                      disabled={isCreating}
                    />
                  </PromptInputBody>

                  <PromptInputFooter>
                    <PromptInputTools>
                      <PromptInputActionMenu>
                        <PromptInputActionMenuTrigger />
                        <PromptInputActionMenuContent>
                          <PromptInputActionAddAttachments />
                        </PromptInputActionMenuContent>
                      </PromptInputActionMenu>

                      <PromptInputButton
                        variant={webSearch ? "default" : "ghost"}
                        onClick={() => setWebSearch(!webSearch)}
                      >
                        <GlobeIcon size={16} />
                        <span>Search</span>
                      </PromptInputButton>
                    </PromptInputTools>

                    {isCreating ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader size={16} />
                        <span>Creating project...</span>
                      </div>
                    ) : (
                      <PromptInputSubmit disabled={!input.trim()} />
                    )}
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          </div>
        </div>

        {/* PAST PROJECTS SECTION */}
        <div className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-8xl rounded-[32px] border border-white/38 bg-white/78 p-6 shadow-[0_32px_90px_-38px_rgba(15,23,42,0.55)] backdrop-blur-xl sm:p-8">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-800/70">
                  Workspace
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Past Projects
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-600">
                Reopen active builds, monitor what&apos;s still running, and
                keep your work visible even with the background art in place.
              </p>
            </div>

            <div>
              {isLoadingProjects ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[1, 2, 3].map((i) => (
                    <Card
                      key={i}
                      className="w-full gap-4 overflow-hidden border-white/55 bg-white/86 py-4 shadow-lg shadow-slate-900/5"
                    >
                      <CardHeader className="px-4 pb-0">
                        <Skeleton className="mb-2 h-4 w-2/3 bg-slate-200/80" />
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/75 px-3 py-2 w-fit">
                          <Skeleton className="h-2.5 w-2.5 rounded-full bg-slate-300/80" />
                          <Skeleton className="h-3 w-16 bg-slate-200/80" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : activeProjects.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300/80 bg-white/55 px-6 py-12 text-center">
                  <p className="text-base font-medium text-slate-800">
                    No projects yet.
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Start by describing what you want to build, and your first
                    project will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {activeProjects.map((project) => (
                    <Card
                      key={project.id}
                      className="w-full cursor-pointer gap-4 overflow-hidden border-white/60 bg-white/88 py-4 shadow-lg shadow-slate-900/8 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-xl hover:shadow-slate-900/10"
                      onClick={() => handleProjectClick(project.id)}
                    >
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="truncate text-sm text-slate-900">
                          {project.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pt-0 text-xs text-slate-600">
                        <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/70 px-3 py-2 w-fit">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              project.status === "running"
                                ? "bg-emerald-500"
                                : project.status === "error"
                                  ? "bg-rose-500"
                                  : "bg-amber-500"
                            }`}
                          />
                          <span className="font-medium capitalize text-slate-700">
                            {project.status}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewChatPage;
