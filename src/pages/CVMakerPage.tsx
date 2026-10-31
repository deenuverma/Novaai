import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Download,
  FilePlus2,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '../components/layout/AppShell.tsx';
import { CVPreviewDocument } from '../components/cv/CVPreviewDocument.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Textarea } from '../components/ui/textarea.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { cvApi } from '../services/api.ts';
import {
  createEmptyCVData,
  createSampleCVData,
  type CVDocumentData,
  type CVRecord,
  type CVTemplateId,
} from '../types/models.ts';

const FORM_STEPS = [
  { id: 'personal', label: '1. Personal' },
  { id: 'summary', label: '2. Summary' },
  { id: 'education', label: '3. Education' },
  { id: 'skills', label: '4. Skills' },
  { id: 'experience', label: '5. Experience' },
  { id: 'projects', label: '6. Projects' },
  { id: 'certifications', label: '7. Certifications' },
] as const;

type StepId = (typeof FORM_STEPS)[number]['id'];

const TEMPLATES: { id: CVTemplateId; label: string; desc: string }[] = [
  {
    id: 'executive',
    label: 'Executive Sans',
    desc: 'Modern single-column Helvetica',
  },
  {
    id: 'classic',
    label: 'Classic Serif',
    desc: 'Academic single-column Times',
  },
  {
    id: 'technical',
    label: 'Technical Compact',
    desc: 'High-density engineering layout',
  },
];

export function CVMakerPage() {
  const { user, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [savedCVs, setSavedCVs] = useState<CVRecord[]>([]);
  const [activeCVId, setActiveCVId] = useState<number | null>(null);
  const [cvTitle, setCvTitle] = useState('Software Engineer Resume');
  const [templateId, setTemplateId] = useState<CVTemplateId>('executive');
  const [cvData, setCvData] = useState<CVDocumentData>(() =>
    createSampleCVData()
  );

  const [activeStep, setActiveStep] = useState<StepId>('personal');
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const loadUserCVs = useCallback(async () => {
    if (!user) return;
    try {
      const res = await cvApi.listCVs(1);
      setSavedCVs(res.items);

      const paramId = Number(searchParams.get('id'));
      if (paramId && res.items.some((item) => item.id === paramId)) {
        const match = res.items.find((item) => item.id === paramId)!;
        setActiveCVId(match.id);
        setCvTitle(match.title);
        setTemplateId(match.templateId);
        setCvData(match.data);
      } else if (res.items.length > 0 && activeCVId === null) {
        const latest = res.items[0];
        setActiveCVId(latest.id);
        setCvTitle(latest.title);
        setTemplateId(latest.templateId);
        setCvData(latest.data);
      }
    } catch (err) {
      console.error('Failed to fetch saved CVs:', err);
    }
  }, [user, searchParams, activeCVId]);

  useEffect(() => {
    loadUserCVs();
  }, [loadUserCVs]);

  const handleSelectSavedCV = (idStr: string) => {
    if (idStr === 'new') {
      setActiveCVId(null);
      setCvTitle('My ATS Resume');
      setCvData(createEmptyCVData(user?.name || '', user?.email || ''));
      setSearchParams({});
      return;
    }
    const found = savedCVs.find((c) => c.id === Number(idStr));
    if (found) {
      setActiveCVId(found.id);
      setCvTitle(found.title);
      setTemplateId(found.templateId);
      setCvData(found.data);
      setSearchParams({ id: String(found.id) });
    }
  };

  const handleLoadSample = () => {
    setCvData(createSampleCVData());
    toast.success('Loaded sample ATS software engineering resume.');
  };

  const handleSaveCV = async () => {
    if (!user) {
      toast.error('Please sign in to save your CV to your account.');
      return;
    }
    setSaving(true);
    try {
      if (activeCVId) {
        const res = await cvApi.updateCV(activeCVId, {
          title: cvTitle.trim() || 'Untitled CV',
          templateId,
          data: cvData,
        });
        setSavedCVs((prev) =>
          prev.map((c) => (c.id === res.cv.id ? res.cv : c))
        );
        toast.success('CV changes saved.');
      } else {
        const res = await cvApi.createCV({
          title: cvTitle.trim() || 'Untitled CV',
          templateId,
          data: cvData,
        });
        setActiveCVId(res.cv.id);
        setSavedCVs((prev) => [res.cv, ...prev]);
        setSearchParams({ id: String(res.cv.id) });
        refreshProfile();
        toast.success('New CV saved to your account.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save CV.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCV = async () => {
    if (!user || !activeCVId) return;
    try {
      await cvApi.deleteCV(activeCVId);
      const remaining = savedCVs.filter((c) => c.id !== activeCVId);
      setSavedCVs(remaining);
      refreshProfile();
      if (remaining[0]) {
        setActiveCVId(remaining[0].id);
        setCvTitle(remaining[0].title);
        setTemplateId(remaining[0].templateId);
        setCvData(remaining[0].data);
      } else {
        setActiveCVId(null);
        setCvTitle('My ATS Resume');
        setCvData(createEmptyCVData(user.name, user.email));
      }
      toast.success('CV deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    const filename = `${
      (cvData.personal.fullName || cvTitle || 'NOVAAI-Resume')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'Resume'
    }-ATS-CV.pdf`;

    try {
      if (user && activeCVId) {
        await cvApi.updateCV(activeCVId, {
          title: cvTitle.trim() || 'Untitled CV',
          templateId,
          data: cvData,
        });
        await cvApi.downloadSavedPdf(activeCVId, filename);
      } else {
        await cvApi.downloadInstantPdf(
          {
            title: cvTitle.trim() || 'Untitled CV',
            templateId,
            data: cvData,
          },
          filename
        );
      }
      toast.success('Selectable-text ATS PDF downloaded.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to export ATS PDF.'
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const stepIndex = FORM_STEPS.findIndex((s) => s.id === activeStep);

  return (
    <AppShell>
      <div className="animate-nova-enter mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Top Action Header */}
        <div className="flex flex-col gap-4 border-b border-[#DCE3DF] pb-5 xl:flex-row xl:items-center xl:justify-between dark:border-[#23312B]">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#9A633A] uppercase dark:text-[#D4A373]">
              Career Document Studio
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#111916] dark:text-[#F2F6F4]">
              ATS-Friendly CV Maker
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-[#52645B] dark:text-[#94A89E]">
              Single-column layout · Standard fonts · Zero tables or graphics · Selectable PDF text
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {user && (
              <select
                aria-label="Select saved CV"
                value={activeCVId ? String(activeCVId) : 'new'}
                onChange={(e) => handleSelectSavedCV(e.target.value)}
                className="h-10 rounded-xl border border-[#C2CEC8] bg-white px-3 text-xs font-semibold text-[#111916] focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#10B981]/25 dark:border-[#2A3933] dark:bg-[#131B18] dark:text-[#F2F6F4]"
              >
                <option value="new">+ New Blank CV</option>
                {savedCVs.map((cv) => (
                  <option key={cv.id} value={String(cv.id)}>
                    {cv.title}
                  </option>
                ))}
              </select>
            )}

            <Button size="sm" variant="outline" onClick={handleLoadSample}>
              <Sparkles className="h-3.5 w-3.5" />
              <span>Sample Data</span>
            </Button>

            {user ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSelectSavedCV('new')}
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  <span>New</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSaveCV}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>{activeCVId ? 'Save Changes' : 'Save CV'}</span>
                </Button>
                {activeCVId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDeleteCV}
                    aria-label="Delete saved CV"
                  >
                    <Trash2 className="h-4 w-4 text-[#9A633A] dark:text-[#D4A373]" />
                  </Button>
                )}
              </>
            ) : (
              <Link
                to="/login"
                state={{ from: '/cv' }}
                className="inline-flex h-9 items-center rounded-xl border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
              >
                Sign in to save CVs
              </Link>
            )}

            <Button
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>Download PDF</span>
            </Button>
          </div>
        </div>

        {/* Template Selector & CV Title */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-5">
            <label
              htmlFor="cv-doc-title"
              className="mb-1 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]"
            >
              Document Name
            </label>
            <Input
              id="cv-doc-title"
              value={cvTitle}
              onChange={(e) => setCvTitle(e.target.value)}
              placeholder="e.g. Campus Placement Software Resume"
            />
          </div>

          <div className="md:col-span-7">
            <span className="mb-1 block text-xs font-semibold text-[#2C3A34] dark:text-[#DCE6E1]">
              ATS Template Style
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateId(tpl.id)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                    templateId === tpl.id
                      ? 'border-[#059669] bg-[#ECFDF5] text-[#111916] dark:border-[#10B981] dark:bg-[#0F261F] dark:text-[#F2F6F4]'
                      : 'border-[#DCE3DF] bg-white text-[#2C3A34] hover:border-[#059669]/50 dark:border-[#23312B] dark:bg-[#131B18] dark:text-[#DCE6E1]'
                  }`}
                >
                  <p className="truncate text-xs font-semibold">{tpl.label}</p>
                  <p className="truncate text-[11px] text-[#52645B] dark:text-[#94A89E]">
                    {tpl.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Form vs Live Preview Tabs (< 1024px) */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-[#DCE3DF] bg-white p-1 lg:hidden dark:border-[#23312B] dark:bg-[#131B18]">
          <button
            type="button"
            onClick={() => setMobileTab('form')}
            className={`h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mobileTab === 'form'
                ? 'bg-[#059669] text-white dark:bg-[#10B981] dark:text-[#061510]'
                : 'text-[#52645B] dark:text-[#94A89E]'
            }`}
          >
            Edit CV Details
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mobileTab === 'preview'
                ? 'bg-[#059669] text-white dark:bg-[#10B981] dark:text-[#061510]'
                : 'text-[#52645B] dark:text-[#94A89E]'
            }`}
          >
            Live ATS Preview
          </button>
        </div>

        {/* Side-by-Side Desktop / Tabbed Mobile Workspace */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* LEFT: Step-by-Step Editor */}
          <div
            className={`lg:col-span-6 ${
              mobileTab === 'preview' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Stepper Navigation */}
            <div className="flex gap-1.5 overflow-x-auto pb-2">
              {FORM_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeStep === step.id
                      ? 'bg-[#059669] text-white dark:bg-[#10B981] dark:text-[#061510]'
                      : 'border border-[#DCE3DF] bg-white text-[#4A5B53] hover:bg-[#EAEEEC] dark:border-[#23312B] dark:bg-[#131B18] dark:text-[#9AB0A6] dark:hover:bg-[#18221E]'
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>

            <div className="nova-3d-card mt-3 rounded-2xl p-5 sm:p-6">
              {/* STEP 1: PERSONAL DETAILS */}
              {activeStep === 'personal' && (
                <div className="space-y-4">
                  <h2 className="font-display text-base font-semibold">
                    Personal &amp; Contact Information
                  </h2>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Full Name
                      </label>
                      <Input
                        value={cvData.personal.fullName}
                        onChange={(e) =>
                          setCvData((d) => ({
                            ...d,
                            personal: { ...d.personal, fullName: e.target.value },
                          }))
                        }
                        placeholder="Aarav Verma"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Target Role / Headline
                      </label>
                      <Input
                        value={cvData.personal.jobTitle}
                        onChange={(e) =>
                          setCvData((d) => ({
                            ...d,
                            personal: { ...d.personal, jobTitle: e.target.value },
                          }))
                        }
                        placeholder="Full-Stack Software Engineer"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={cvData.personal.email}
                        onChange={(e) =>
                          setCvData((d) => ({
                            ...d,
                            personal: { ...d.personal, email: e.target.value },
                          }))
                        }
                        placeholder="aarav@example.com"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Phone
                      </label>
                      <Input
                        value={cvData.personal.phone}
                        onChange={(e) =>
                          setCvData((d) => ({
                            ...d,
                            personal: { ...d.personal, phone: e.target.value },
                          }))
                        }
                        placeholder="+91 98110 24580"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Location
                      </label>
                      <Input
                        value={cvData.personal.location}
                        onChange={(e) =>
                          setCvData((d) => ({
                            ...d,
                            personal: { ...d.personal, location: e.target.value },
                          }))
                        }
                        placeholder="Bengaluru, India"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        LinkedIn URL
                      </label>
                      <Input
                        value={cvData.personal.linkedin}
                        onChange={(e) =>
                          setCvData((d) => ({
                            ...d,
                            personal: { ...d.personal, linkedin: e.target.value },
                          }))
                        }
                        placeholder="linkedin.com/in/username"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        GitHub URL
                      </label>
                      <Input
                        value={cvData.personal.github}
                        onChange={(e) =>
                          setCvData((d) => ({
                            ...d,
                            personal: { ...d.personal, github: e.target.value },
                          }))
                        }
                        placeholder="github.com/username"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Portfolio / Website
                      </label>
                      <Input
                        value={cvData.personal.website}
                        onChange={(e) =>
                          setCvData((d) => ({
                            ...d,
                            personal: { ...d.personal, website: e.target.value },
                          }))
                        }
                        placeholder="yourportfolio.dev"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: SUMMARY */}
              {activeStep === 'summary' && (
                <div className="space-y-3">
                  <h2 className="font-display text-base font-semibold">
                    Professional Summary
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Write 2–4 concise sentences highlighting core technologies, domain experience, and measurable outcomes.
                  </p>
                  <Textarea
                    rows={5}
                    value={cvData.summary}
                    onChange={(e) =>
                      setCvData((d) => ({ ...d, summary: e.target.value }))
                    }
                    placeholder="Full-Stack Software Engineer with experience in TypeScript, React, Node.js, and PostgreSQL..."
                  />
                </div>
              )}

              {/* STEP 3: EDUCATION */}
              {activeStep === 'education' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold">
                      Education
                    </h2>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCvData((d) => ({
                          ...d,
                          education: [
                            ...d.education,
                            {
                              id: `edu-${Date.now()}`,
                              institution: '',
                              degree: '',
                              field: '',
                              location: '',
                              startDate: '',
                              endDate: '',
                              grade: '',
                            },
                          ],
                        }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Education</span>
                    </Button>
                  </div>

                  {cvData.education.map((edu, index) => (
                    <div
                      key={edu.id}
                      className="space-y-3 border-t border-slate-200 pt-4 first:border-0 first:pt-0 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          Entry #{index + 1}
                        </span>
                        {cvData.education.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setCvData((d) => ({
                                ...d,
                                education: d.education.filter(
                                  (item) => item.id !== edu.id
                                ),
                              }))
                            }
                            className="text-xs font-medium text-[#9A633A] hover:underline dark:text-[#D4A373] cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Input
                            placeholder="Institution / University"
                            value={edu.institution}
                            onChange={(e) =>
                              setCvData((d) => ({
                                ...d,
                                education: d.education.map((it) =>
                                  it.id === edu.id
                                    ? { ...it, institution: e.target.value }
                                    : it
                                ),
                              }))
                            }
                          />
                        </div>
                        <Input
                          placeholder="Degree (e.g. B.Tech)"
                          value={edu.degree}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              education: d.education.map((it) =>
                                it.id === edu.id
                                  ? { ...it, degree: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="Field of Study (e.g. Computer Science)"
                          value={edu.field}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              education: d.education.map((it) =>
                                it.id === edu.id
                                  ? { ...it, field: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="Start Date (e.g. Aug 2022)"
                          value={edu.startDate}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              education: d.education.map((it) =>
                                it.id === edu.id
                                  ? { ...it, startDate: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="End Date (e.g. May 2026)"
                          value={edu.endDate}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              education: d.education.map((it) =>
                                it.id === edu.id
                                  ? { ...it, endDate: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="CGPA / Percentage (e.g. 9.1 / 10)"
                          value={edu.grade}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              education: d.education.map((it) =>
                                it.id === edu.id
                                  ? { ...it, grade: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="Location"
                          value={edu.location}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              education: d.education.map((it) =>
                                it.id === edu.id
                                  ? { ...it, location: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* STEP 4: SKILLS */}
              {activeStep === 'skills' && (
                <div className="space-y-4">
                  <h2 className="font-display text-base font-semibold">
                    Technical &amp; Domain Skills
                  </h2>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Programming Languages
                    </label>
                    <Input
                      value={cvData.skills.languages}
                      onChange={(e) =>
                        setCvData((d) => ({
                          ...d,
                          skills: { ...d.skills, languages: e.target.value },
                        }))
                      }
                      placeholder="TypeScript, JavaScript, Python, SQL, C++"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Frameworks &amp; Libraries
                    </label>
                    <Input
                      value={cvData.skills.frameworks}
                      onChange={(e) =>
                        setCvData((d) => ({
                          ...d,
                          skills: { ...d.skills, frameworks: e.target.value },
                        }))
                      }
                      placeholder="React, Next.js, Node.js, Express, Tailwind CSS"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Developer Tools &amp; Databases
                    </label>
                    <Input
                      value={cvData.skills.tools}
                      onChange={(e) =>
                        setCvData((d) => ({
                          ...d,
                          skills: { ...d.skills, tools: e.target.value },
                        }))
                      }
                      placeholder="PostgreSQL, Docker, Git, Linux, GitHub Actions"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Core Competencies
                    </label>
                    <Input
                      value={cvData.skills.core}
                      onChange={(e) =>
                        setCvData((d) => ({
                          ...d,
                          skills: { ...d.skills, core: e.target.value },
                        }))
                      }
                      placeholder="Data Structures & Algorithms, System Design, REST APIs"
                    />
                  </div>
                </div>
              )}

              {/* STEP 5: EXPERIENCE */}
              {activeStep === 'experience' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold">
                      Work Experience &amp; Internships
                    </h2>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCvData((d) => ({
                          ...d,
                          experience: [
                            ...d.experience,
                            {
                              id: `exp-${Date.now()}`,
                              company: '',
                              role: '',
                              location: '',
                              startDate: '',
                              endDate: '',
                              highlights: [''],
                            },
                          ],
                        }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Role</span>
                    </Button>
                  </div>

                  {cvData.experience.map((exp, idx) => (
                    <div
                      key={exp.id}
                      className="space-y-3 border-t border-slate-200 pt-4 first:border-0 first:pt-0 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          Experience #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCvData((d) => ({
                              ...d,
                              experience: d.experience.filter(
                                (it) => it.id !== exp.id
                              ),
                            }))
                          }
                          className="text-xs font-medium text-[#9A633A] hover:underline dark:text-[#D4A373] cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                          placeholder="Job Title / Role"
                          value={exp.role}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              experience: d.experience.map((it) =>
                                it.id === exp.id
                                  ? { ...it, role: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="Company / Organization"
                          value={exp.company}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              experience: d.experience.map((it) =>
                                it.id === exp.id
                                  ? { ...it, company: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="Start Date (e.g. May 2025)"
                          value={exp.startDate}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              experience: d.experience.map((it) =>
                                it.id === exp.id
                                  ? { ...it, startDate: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="End Date (e.g. Present)"
                          value={exp.endDate}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              experience: d.experience.map((it) =>
                                it.id === exp.id
                                  ? { ...it, endDate: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                          Impact Bullet Points (one per line)
                        </label>
                        <Textarea
                          rows={4}
                          value={exp.highlights.join('\n')}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              experience: d.experience.map((it) =>
                                it.id === exp.id
                                  ? {
                                      ...it,
                                      highlights: e.target.value.split('\n'),
                                    }
                                  : it
                              ),
                            }))
                          }
                          placeholder="Engineered REST APIs reducing latency by 45%..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* STEP 6: PROJECTS */}
              {activeStep === 'projects' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold">
                      Key Academic &amp; Engineering Projects
                    </h2>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCvData((d) => ({
                          ...d,
                          projects: [
                            ...d.projects,
                            {
                              id: `proj-${Date.now()}`,
                              name: '',
                              techStack: '',
                              link: '',
                              description: [''],
                            },
                          ],
                        }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Project</span>
                    </Button>
                  </div>

                  {cvData.projects.map((proj, idx) => (
                    <div
                      key={proj.id}
                      className="space-y-3 border-t border-slate-200 pt-4 first:border-0 first:pt-0 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          Project #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCvData((d) => ({
                              ...d,
                              projects: d.projects.filter(
                                (it) => it.id !== proj.id
                              ),
                            }))
                          }
                          className="text-xs font-medium text-[#9A633A] hover:underline dark:text-[#D4A373] cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                          placeholder="Project Title"
                          value={proj.name}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              projects: d.projects.map((it) =>
                                it.id === proj.id
                                  ? { ...it, name: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="Tech Stack (e.g. React, PostgreSQL)"
                          value={proj.techStack}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              projects: d.projects.map((it) =>
                                it.id === proj.id
                                  ? { ...it, techStack: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <div className="sm:col-span-2">
                          <Input
                            placeholder="Repository or Live Link"
                            value={proj.link}
                            onChange={(e) =>
                              setCvData((d) => ({
                                ...d,
                                projects: d.projects.map((it) =>
                                  it.id === proj.id
                                    ? { ...it, link: e.target.value }
                                    : it
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                          Bullet Points (one per line)
                        </label>
                        <Textarea
                          rows={3}
                          value={proj.description.join('\n')}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              projects: d.projects.map((it) =>
                                it.id === proj.id
                                  ? {
                                      ...it,
                                      description: e.target.value.split('\n'),
                                    }
                                  : it
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* STEP 7: CERTIFICATIONS */}
              {activeStep === 'certifications' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold">
                      Certifications &amp; Achievements
                    </h2>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCvData((d) => ({
                          ...d,
                          certifications: [
                            ...d.certifications,
                            {
                              id: `cert-${Date.now()}`,
                              name: '',
                              issuer: '',
                              date: '',
                              credentialUrl: '',
                            },
                          ],
                        }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Certification</span>
                    </Button>
                  </div>

                  {cvData.certifications.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Optional: Add cloud certifications, coding competition ranks, or fellowships.
                    </p>
                  ) : (
                    cvData.certifications.map((cert) => (
                      <div
                        key={cert.id}
                        className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3 dark:border-slate-800"
                      >
                        <Input
                          placeholder="Certification Name"
                          value={cert.name}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              certifications: d.certifications.map((it) =>
                                it.id === cert.id
                                  ? { ...it, name: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="Issuing Organization"
                          value={cert.issuer}
                          onChange={(e) =>
                            setCvData((d) => ({
                              ...d,
                              certifications: d.certifications.map((it) =>
                                it.id === cert.id
                                  ? { ...it, issuer: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Year (e.g. 2025)"
                            value={cert.date}
                            onChange={(e) =>
                              setCvData((d) => ({
                                ...d,
                                certifications: d.certifications.map((it) =>
                                  it.id === cert.id
                                    ? { ...it, date: e.target.value }
                                    : it
                                ),
                              }))
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setCvData((d) => ({
                                ...d,
                                certifications: d.certifications.filter(
                                  (it) => it.id !== cert.id
                                ),
                              }))
                            }
                            className="text-xs font-medium text-[#9A633A] hover:underline shrink-0 dark:text-[#D4A373] cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Previous / Next Step Footer */}
              <div className="mt-6 flex items-center justify-between border-t border-[#DCE3DF] pt-4 dark:border-[#23312B]">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={stepIndex <= 0}
                  onClick={() =>
                    setActiveStep(FORM_STEPS[Math.max(0, stepIndex - 1)].id)
                  }
                >
                  Previous Section
                </Button>
                {stepIndex < FORM_STEPS.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      setActiveStep(
                        FORM_STEPS[
                          Math.min(FORM_STEPS.length - 1, stepIndex + 1)
                        ].id
                      )
                    }
                  >
                    Next Section
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export ATS PDF</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Live Real-Time ATS Resume Preview */}
          <div
            className={`lg:col-span-6 lg:sticky lg:top-6 ${
              mobileTab === 'form' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="nova-3d-card rounded-2xl p-3 sm:p-5">
              <div className="mb-3 flex items-center justify-between text-xs text-[#52645B] dark:text-[#94A89E]">
                <span className="font-semibold text-[#059669] dark:text-[#34D399]">
                  Live Single-Column ATS Preview
                </span>
                <span>A4 · Selectable Text PDF</span>
              </div>
              <CVPreviewDocument templateId={templateId} data={cvData} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
