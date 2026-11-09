"use client";

import React, { useState, useEffect, use } from "react";
import {
  Award,
  ShieldCheck,
  ExternalLink,
  GraduationCap,
  Building,
  Mail,
  Phone,
  FileText,
  AlertCircle,
  Printer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/common/brand-loader";

export default function PublicPassportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [passport, setPassport] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPublicData() {
      try {
        const res = await fetch(`/api/public/passport/${token}`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "This Career Passport link is invalid or has expired.");
        }
        const json = await res.json();
        setPassport(json.data);
      } catch (err: any) {
        setError(err.message || "Failed to load career passport.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchPublicData();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EDECE7] flex flex-col items-center justify-center p-4">
        <BrandLoader size="lg" />
        <p className="text-sm font-medium text-[#292D40]/70 mt-3 font-inter">
          Verifying Career Passport Credential...
        </p>
      </div>
    );
  }

  if (error || !passport) {
    return (
      <div className="min-h-screen bg-[#EDECE7] flex items-center justify-center p-4 font-inter">
        <div className="bg-[#FBFAF7] border border-[#DDDCD5] rounded-3xl p-8 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold font-outfit text-[#24283A]">
            Passport Unavailable
          </h2>
          <p className="text-xs text-[#747683] leading-relaxed">
            {error || "This link may have been revoked by the candidate or reached its expiration date."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDECE7] py-8 px-4 font-inter">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header Verification Badge */}
        <div className="flex items-center justify-between text-xs text-[#747683] px-2 print:hidden">
          <div className="flex items-center gap-1.5 font-semibold text-[#5052C9]">
            <Award className="w-4 h-4" />
            <span>UrPlaced Collegiate Verified Passport</span>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 hover:text-[#24283A] transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save</span>
          </button>
        </div>

        {/* Passport Card */}
        <div className="bg-[#FBFAF7] border border-[#DDDCD5] rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
          {/* Candidate Profile Header */}
          <div className="border-b border-[#DDDCD5] pb-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-extrabold font-outfit text-[#24283A]">
                  {passport.studentName}
                </h1>
                {passport.headline && (
                  <p className="text-base font-semibold text-[#5052C9] font-outfit mt-0.5">
                    {passport.headline}
                  </p>
                )}
              </div>

              <Badge className="bg-[#2E8F86] text-white text-xs px-3 py-1 self-start sm:self-center shadow-xs">
                Verified Candidate
              </Badge>
            </div>

            {/* Sub-line */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#747683]">
              <span className="flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-[#5052C9]" />
                {passport.degree}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-[#5052C9]" />
                {passport.institution}
              </span>
              <span>•</span>
              <span>Class of {passport.graduationYear}</span>
              {passport.cgpa && (
                <>
                  <span>•</span>
                  <strong className="text-[#24283A]">CGPA: {passport.cgpa}</strong>
                </>
              )}
            </div>

            {/* Approved Contact details */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#24283A] pt-2">
              {passport.email && (
                <a
                  href={`mailto:${passport.email}`}
                  className="flex items-center gap-1.5 hover:text-[#5052C9]"
                >
                  <Mail className="w-3.5 h-3.5 text-[#747683]" />
                  <span>{passport.email}</span>
                </a>
              )}
              {passport.phone && (
                <span className="flex items-center gap-1.5 text-[#747683]">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{passport.phone}</span>
                </span>
              )}
              {passport.githubUrl && (
                <a
                  href={passport.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5052C9] hover:underline flex items-center gap-1"
                >
                  GitHub <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {passport.linkedinUrl && (
                <a
                  href={passport.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5052C9] hover:underline flex items-center gap-1"
                >
                  LinkedIn <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Professional Summary */}
          {passport.summary && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold font-outfit text-[#5052C9] uppercase tracking-wider">
                Professional Summary
              </h2>
              <p className="text-xs md:text-sm text-[#24283A] leading-relaxed">
                {passport.summary}
              </p>
            </div>
          )}

          {/* Technical Proficiencies */}
          {passport.skills && passport.skills.technical && passport.skills.technical.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold font-outfit text-[#5052C9] uppercase tracking-wider">
                Technical Proficiencies
              </h2>
              <div className="flex flex-wrap gap-2">
                {passport.skills.technical.map((skill: any, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-[#EDECE7] text-[#24283A] border border-[#DDDCD5] font-medium"
                  >
                    <span>{skill.name}</span>
                    {skill.isVerified && (
                      <span title="Verified by campus evaluation">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#2E8F86]" />
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio Projects */}
          {passport.projects && passport.projects.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold font-outfit text-[#5052C9] uppercase tracking-wider">
                Portfolio Projects
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {passport.projects.map((proj: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-[#F8F7F3] border border-[#DDDCD5] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#24283A] font-outfit">{proj.title}</span>
                      {proj.githubUrl && (
                        <a
                          href={proj.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#5052C9] hover:underline flex items-center gap-1 font-semibold"
                        >
                          Code <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-[#292D40]/85 leading-relaxed">
                      {proj.description}
                    </p>
                    {proj.technologies && proj.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {proj.technologies.map((t: string, tIdx: number) => (
                          <span
                            key={tIdx}
                            className="text-[10px] px-2 py-0.5 rounded bg-[#EDECE7] text-[#292D40]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Internships & Experience */}
          {passport.experience && passport.experience.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold font-outfit text-[#5052C9] uppercase tracking-wider">
                Internships &amp; Professional Experience
              </h2>
              <div className="space-y-3">
                {passport.experience.map((exp: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-2xl bg-[#F8F7F3] border border-[#DDDCD5] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#24283A]">{exp.designation} — {exp.organization}</span>
                      <span className="text-[11px] text-[#747683]">
                        {exp.startDate} {exp.isCurrent ? "- Present" : `- ${exp.endDate || ""}`}
                      </span>
                    </div>
                    {exp.responsibilities && exp.responsibilities.length > 0 && (
                      <ul className="list-disc pl-4 text-xs text-[#292D40]/80 space-y-1">
                        {exp.responsibilities.map((r: string, rIdx: number) => (
                          <li key={rIdx}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {passport.certifications && passport.certifications.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold font-outfit text-[#5052C9] uppercase tracking-wider">
                Verified Certifications
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {passport.certifications.map((c: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-[#F8F7F3] border border-[#DDDCD5] text-xs">
                    <span className="font-bold text-[#24283A] block">{c.name}</span>
                    <span className="text-[#747683] text-[11px] block">{c.issuingOrganization}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-6 border-t border-[#DDDCD5] text-center text-xs text-[#747683]">
            <p>Certified Student Career Passport • Powered by UrPlaced Collegiate Platform</p>
          </div>
        </div>
      </div>
    </div>
  );
}
