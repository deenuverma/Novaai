import React from 'react';
import type { CVDocumentData, CVTemplateId } from '../../types/models.ts';
import { cn } from '../../lib/utils.ts';

interface CVPreviewDocumentProps {
  templateId: CVTemplateId;
  data: CVDocumentData;
}

export function CVPreviewDocument({
  templateId,
  data,
}: CVPreviewDocumentProps) {
  const isClassic = templateId === 'classic';
  const isTechnical = templateId === 'technical';

  const contactParts = [
    data.personal.email?.trim(),
    data.personal.phone?.trim(),
    data.personal.location?.trim(),
    data.personal.linkedin?.trim(),
    data.personal.github?.trim(),
    data.personal.website?.trim(),
  ].filter(Boolean);

  const skillRows = [
    { label: 'Programming Languages', value: data.skills.languages },
    { label: 'Frameworks & Libraries', value: data.skills.frameworks },
    { label: 'Developer Tools & Platforms', value: data.skills.tools },
    { label: 'Core Competencies', value: data.skills.core },
  ].filter((r) => r.value?.trim());

  const validExperience = data.experience.filter(
    (e) => e.company.trim() || e.role.trim()
  );
  const validProjects = data.projects.filter((p) => p.name.trim());
  const validEducation = data.education.filter(
    (ed) => ed.institution.trim() || ed.degree.trim()
  );
  const validCertifications = data.certifications.filter((c) => c.name.trim());

  const sectionTitleClass = cn(
    'border-b border-slate-300 pb-1 text-slate-900 font-bold',
    isClassic
      ? 'text-[13px] uppercase tracking-wider mt-4 mb-2'
      : isTechnical
        ? 'text-[11.5px] uppercase tracking-wider mt-3.5 mb-1.5 font-mono'
        : 'text-[13px] mt-4 mb-2'
  );

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[794px] rounded-md border border-slate-200 bg-white p-6 sm:p-10 text-slate-900 shadow-sm',
        isClassic
          ? 'font-serif text-[13px] leading-[1.48]'
          : isTechnical
            ? 'font-sans text-[12px] leading-[1.42]'
            : 'font-sans text-[12.8px] leading-[1.48]'
      )}
    >
      {/* Single-Column ATS Header */}
      <header className={cn(isClassic ? 'text-center' : 'text-left')}>
        <h1
          className={cn(
            'font-bold text-slate-950',
            isClassic
              ? 'font-serif text-2xl'
              : isTechnical
                ? 'font-sans text-xl tracking-tight'
                : 'font-sans text-2xl tracking-tight'
          )}
        >
          {data.personal.fullName?.trim() || 'Your Full Name'}
        </h1>
        {data.personal.jobTitle?.trim() && (
          <p className="mt-0.5 text-sm font-medium text-slate-700">
            {data.personal.jobTitle.trim()}
          </p>
        )}
        {contactParts.length > 0 && (
          <p className="mt-1.5 text-[11.5px] text-slate-600 break-words">
            {contactParts.join('  |  ')}
          </p>
        )}
      </header>

      {/* Summary */}
      {data.summary?.trim() && (
        <section>
          <h2 className={sectionTitleClass}>Professional Summary</h2>
          <p className="text-slate-800 whitespace-pre-line">
            {data.summary.trim()}
          </p>
        </section>
      )}

      {/* Technical Skills */}
      {skillRows.length > 0 && (
        <section>
          <h2 className={sectionTitleClass}>Technical Skills</h2>
          <div className="space-y-1">
            {skillRows.map((row) => (
              <p key={row.label} className="text-slate-800">
                <span className="font-semibold text-slate-950">
                  {row.label}:{' '}
                </span>
                <span>{row.value.trim()}</span>
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Experience */}
      {validExperience.length > 0 && (
        <section>
          <h2 className={sectionTitleClass}>Work Experience</h2>
          <div className="space-y-3">
            {validExperience.map((exp) => {
              const dates = [exp.startDate.trim(), exp.endDate.trim()]
                .filter(Boolean)
                .join(' – ');
              const orgLine = [exp.company.trim(), exp.location.trim()]
                .filter(Boolean)
                .join(' · ');
              return (
                <div key={exp.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-slate-950">
                      {exp.role.trim() || 'Role'}
                    </h3>
                    {dates && (
                      <span className="text-[11.5px] text-slate-600 tabular-nums">
                        {dates}
                      </span>
                    )}
                  </div>
                  {orgLine && (
                    <p className="italic text-slate-700">{orgLine}</p>
                  )}
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-800">
                    {exp.highlights
                      .filter((h) => h.trim())
                      .map((bullet, i) => (
                        <li key={i}>{bullet.trim()}</li>
                      ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Projects */}
      {validProjects.length > 0 && (
        <section>
          <h2 className={sectionTitleClass}>Key Projects</h2>
          <div className="space-y-2.5">
            {validProjects.map((proj) => (
              <div key={proj.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-slate-950">
                    {proj.name.trim()}
                    {proj.techStack.trim() && (
                      <span className="font-normal text-slate-600">
                        {' '}
                        ({proj.techStack.trim()})
                      </span>
                    )}
                  </h3>
                  {proj.link.trim() && (
                    <span className="text-[11.5px] text-slate-600">
                      {proj.link.trim()}
                    </span>
                  )}
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-800">
                  {proj.description
                    .filter((d) => d.trim())
                    .map((line, i) => (
                      <li key={i}>{line.trim()}</li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {validEducation.length > 0 && (
        <section>
          <h2 className={sectionTitleClass}>Education</h2>
          <div className="space-y-2">
            {validEducation.map((ed) => {
              const dates = [ed.startDate.trim(), ed.endDate.trim()]
                .filter(Boolean)
                .join(' – ');
              const degreeLine = [ed.degree.trim(), ed.field.trim()]
                .filter(Boolean)
                .join(' in ');
              const details = [
                degreeLine,
                ed.grade.trim() ? `GPA / Score: ${ed.grade.trim()}` : '',
                ed.location.trim(),
              ].filter(Boolean);

              return (
                <div key={ed.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-slate-950">
                      {ed.institution.trim() || degreeLine}
                    </h3>
                    {dates && (
                      <span className="text-[11.5px] text-slate-600 tabular-nums">
                        {dates}
                      </span>
                    )}
                  </div>
                  {details.length > 0 && (
                    <p className="text-slate-700">{details.join(' · ')}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Certifications */}
      {validCertifications.length > 0 && (
        <section>
          <h2 className={sectionTitleClass}>Certifications</h2>
          <ul className="list-disc space-y-0.5 pl-4 text-slate-800">
            {validCertifications.map((cert) => (
              <li key={cert.id}>
                <span className="font-medium text-slate-950">
                  {cert.name.trim()}
                </span>
                {cert.issuer.trim() ? ` — ${cert.issuer.trim()}` : ''}
                {cert.date.trim() ? ` (${cert.date.trim()})` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
