"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  GraduationCap,
  Code2,
  FolderGit2,
  Briefcase,
  Award,
  Link2,
  Sparkles,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  Github,
  Linkedin,
  Globe,
  Loader2,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import type {
  CareerProfileData,
  TechnicalSkill,
  SoftSkill,
  CareerProject,
  CareerExperience,
  CareerCertification,
} from "@/modules/students/services/student-career-profile-service";

export default function StudentCareerProfilePage() {
  const auth = useAuthContext();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [profile, setProfile] = React.useState<CareerProfileData | null>(null);

  // Form states
  const [headline, setHeadline] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [linkedinUrl, setLinkedinUrl] = React.useState("");
  const [githubUrl, setGithubUrl] = React.useState("");
  const [portfolioUrl, setPortfolioUrl] = React.useState("");

  const [technicalSkills, setTechnicalSkills] = React.useState<TechnicalSkill[]>([]);
  const [softSkills, setSoftSkills] = React.useState<SoftSkill[]>([]);
  const [projects, setProjects] = React.useState<CareerProject[]>([]);
  const [experience, setExperience] = React.useState<CareerExperience[]>([]);
  const [certifications, setCertifications] = React.useState<CareerCertification[]>([]);

  // Input helpers for skills
  const [newTechSkillName, setNewTechSkillName] = React.useState("");
  const [newTechCategory, setNewTechCategory] = React.useState<TechnicalSkill["category"]>("LANGUAGE");
  const [newTechProficiency, setNewTechProficiency] = React.useState<TechnicalSkill["proficiency"]>("INTERMEDIATE");

  const [newSoftSkillName, setNewSoftSkillName] = React.useState("");

  // Preview modal toggle
  const [showPreview, setShowPreview] = React.useState(false);

  // Fetch career profile
  const fetchProfile = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/student/career-profile");
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        const d: CareerProfileData = json.data;
        setProfile(d);
        setHeadline(d.headline || "");
        setBio(d.bio || "");
        setLocation(d.location || "");
        setPhone(d.phone || "");
        setLinkedinUrl(d.linkedinUrl || "");
        setGithubUrl(d.githubUrl || "");
        setPortfolioUrl(d.portfolioUrl || "");
        setTechnicalSkills(d.technicalSkills || []);
        setSoftSkills(d.softSkills || []);
        setProjects(d.projects || []);
        setExperience(d.experience || []);
        setCertifications(d.certifications || []);
      }
    } catch (err: any) {
      console.error("[CareerProfilePage] Load error:", err);
      setError(err.message || "Failed to load career profile");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!auth.isLoading) {
      if (!auth.isAuthenticated) {
        router.push("/auth/signin");
        return;
      }
      fetchProfile();
    }
  }, [auth.isLoading, auth.isAuthenticated, router, fetchProfile]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      setError(null);

      const payload = {
        headline,
        bio,
        location,
        phone,
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        technicalSkills,
        softSkills,
        projects,
        experience,
        certifications,
      };

      const res = await fetch("/api/student/career-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to save profile");
      }

      const json = await res.json();
      if (json.success && json.data) {
        setProfile(json.data);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err: any) {
      console.error("[CareerProfilePage] Save error:", err);
      setError(err.message || "Failed to save career profile");
    } finally {
      setSaving(false);
    }
  };

  // Skill Adders
  const addTechSkill = () => {
    if (!newTechSkillName.trim()) return;
    setTechnicalSkills([
      ...technicalSkills,
      {
        name: newTechSkillName.trim(),
        category: newTechCategory,
        proficiency: newTechProficiency,
      },
    ]);
    setNewTechSkillName("");
  };

  const removeTechSkill = (index: number) => {
    setTechnicalSkills(technicalSkills.filter((_, i) => i !== index));
  };

  const addSoftSkill = () => {
    if (!newSoftSkillName.trim()) return;
    setSoftSkills([
      ...softSkills,
      {
        name: newSoftSkillName.trim(),
        proficiency: "ADVANCED",
      },
    ]);
    setNewSoftSkillName("");
  };

  const removeSoftSkill = (index: number) => {
    setSoftSkills(softSkills.filter((_, i) => i !== index));
  };

  // Project Adder
  const addProject = () => {
    setProjects([
      ...projects,
      {
        id: crypto.randomUUID(),
        title: "New Project",
        description: "",
        technologies: [],
        role: "Developer",
        githubUrl: "",
        liveUrl: "",
      },
    ]);
  };

  const updateProject = (index: number, updates: Partial<CareerProject>) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], ...updates };
    setProjects(updated);
  };

  const removeProject = (index: number) => {
    setProjects(projects.filter((_, i) => i !== index));
  };

  // Experience Adder
  const addExperience = () => {
    setExperience([
      ...experience,
      {
        id: crypto.randomUUID(),
        organization: "Company Name",
        designation: "Software Intern",
        employmentType: "INTERNSHIP",
        startDate: "",
        responsibilities: [""],
      },
    ]);
  };

  const updateExperience = (index: number, updates: Partial<CareerExperience>) => {
    const updated = [...experience];
    updated[index] = { ...updated[index], ...updates };
    setExperience(updated);
  };

  const removeExperience = (index: number) => {
    setExperience(experience.filter((_, i) => i !== index));
  };

  // Certification Adder
  const addCertification = () => {
    setCertifications([
      ...certifications,
      {
        id: crypto.randomUUID(),
        name: "Certificate Name",
        issuingOrganization: "Issuing Body",
        credentialUrl: "",
      },
    ]);
  };

  const updateCertification = (index: number, updates: Partial<CareerCertification>) => {
    const updated = [...certifications];
    updated[index] = { ...updated[index], ...updates };
    setCertifications(updated);
  };

  const removeCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  if (loading || !profile) {
    return <DashboardSkeleton />;
  }

  const completeness = profile.completeness;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-text-secondary font-mono mb-1">
            <Link href="/dashboard/student" className="hover:text-primary transition-colors">
              Student Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-text-primary">Career Profile</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
            Career Profile &amp; Readiness
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary">
            Build your professional resume foundation, technical competencies, and placement portfolio.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPreview(true)}
            className="border-border text-xs gap-1.5"
          >
            <Eye className="h-4 w-4" />
            <span>Preview Profile</span>
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saving ? "Saving..." : "Save Profile"}</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-800 dark:text-teal-300 flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" />
          <span>Career profile successfully saved and completeness recalculated!</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger flex items-center gap-2.5 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Completeness Gauge Card */}
      <Card className="border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-surface/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-bold font-heading">
                  Profile Completeness
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
                  {completeness.overallPercentage}%
                </Badge>
              </div>
              <CardDescription className="text-xs">
                A complete profile substantially elevates ATS parseability and placement drive matching accuracy.
              </CardDescription>
            </div>

            {/* Quick Links */}
            <div className="flex items-center gap-2 shrink-0">
              <Button asChild variant="outline" size="sm" className="text-xs border-border">
                <Link href="/dashboard/student/resume">Resume Scanner</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="text-xs border-border">
                <Link href="/dashboard/student/placement-matches">Drive Matches</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-border/40 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary to-teal-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${completeness.overallPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-text-muted font-mono">
              <span>0% Initial</span>
              <span>100% Placement Ready</span>
            </div>
          </div>

          {/* Actionable Tips if incomplete */}
          {completeness.missingSections.length > 0 && (
            <div className="p-3.5 rounded-xl bg-surface border border-border/60 space-y-2">
              <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-secondary" />
                <span>Recommended Next Steps to Reach 100%:</span>
              </div>
              <ul className="grid sm:grid-cols-2 gap-2 text-[11px] text-text-secondary">
                {completeness.missingSections.map((m) => (
                  <li key={m.sectionKey} className="flex items-start gap-1.5">
                    <span className="text-primary font-bold">&bull;</span>
                    <span>
                      <strong className="text-text-primary">{m.title}:</strong> {m.actionPrompt}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 1: Professional Information */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold font-heading">
              1. Professional &amp; Personal Info
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Core personal summary presented on your applications and resume header.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full Name (Institutional)</Label>
              <Input value={profile.fullName} disabled className="bg-surface/50 opacity-80" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">College Email (Institutional)</Label>
              <Input value={profile.email} disabled className="bg-surface/50 opacity-80" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Professional Headline</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Aspiring Full-Stack Software Engineer | React &amp; Node.js"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bengaluru, India"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Professional Summary / Bio</Label>
            <Textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Brief summary of your technical interests, problem-solving mindset, and career goals..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Verified Academic Details */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-secondary" />
            <CardTitle className="text-base font-bold font-heading">
              2. Verified Academic Records
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Institutional academic parameters used by college placement cells for official drive eligibility.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-4 rounded-xl bg-surface border border-border/60">
            <div>
              <span className="text-[11px] text-text-muted font-mono block">ENROLLMENT / SRN</span>
              <span className="text-sm font-bold font-heading text-text-primary">
                {profile.enrollmentNumber}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-text-muted font-mono block">DEGREE &amp; BRANCH</span>
              <span className="text-sm font-bold font-heading text-text-primary">
                {profile.degree} - {profile.departmentName}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-text-muted font-mono block">CURRENT CGPA</span>
              <span className="text-sm font-bold font-mono text-secondary">
                {profile.cgpa.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-text-muted font-mono block">GRADUATION BATCH</span>
              <span className="text-sm font-bold font-mono text-text-primary">
                {profile.graduationYear}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Technical Skills */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold font-heading">
              3. Technical Skills
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Categorized technical competencies used for recruitment drive matching and ATS analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Skill Tag List */}
          <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-xl border border-border bg-surface/40">
            {technicalSkills.length === 0 ? (
              <span className="text-xs text-text-muted italic">No technical skills added yet.</span>
            ) : (
              technicalSkills.map((skill, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="px-2.5 py-1 text-xs gap-1.5 bg-card border-border hover:border-primary/50 transition-colors"
                >
                  <span className="font-semibold">{skill.name}</span>
                  <span className="text-[10px] text-text-muted font-mono">({skill.proficiency})</span>
                  <button
                    type="button"
                    onClick={() => removeTechSkill(idx)}
                    className="text-text-muted hover:text-danger ml-0.5"
                  >
                    &times;
                  </button>
                </Badge>
              ))
            )}
          </div>

          {/* Add Skill Inputs */}
          <div className="grid gap-3 sm:grid-cols-4 items-end pt-2">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-medium">Skill Name</Label>
              <Input
                value={newTechSkillName}
                onChange={(e) => setNewTechSkillName(e.target.value)}
                placeholder="e.g. TypeScript, PostgreSQL, Docker"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTechSkill();
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Proficiency</Label>
              <select
                value={newTechProficiency}
                onChange={(e) => setNewTechProficiency(e.target.value as any)}
                className="w-full text-xs h-9 rounded-md border border-border bg-input-bg px-2.5 text-text-primary"
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addTechSkill}
              className="text-xs border-border gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Skill</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Projects */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-bold font-heading">
                4. Portfolio Projects
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Demonstrate hands-on software development experience with verifiable links.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addProject}
            className="text-xs border-border gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Project</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-border rounded-xl space-y-2">
              <FolderGit2 className="h-8 w-8 text-text-muted mx-auto" />
              <p className="text-xs text-text-secondary">No projects added yet.</p>
              <Button type="button" variant="outline" size="sm" onClick={addProject} className="text-xs">
                Add Your Flagship Project
              </Button>
            </div>
          ) : (
            projects.map((proj, idx) => (
              <div
                key={proj.id || idx}
                className="p-4 rounded-xl border border-border bg-surface/30 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary font-heading">
                    Project #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeProject(idx)}
                    className="text-text-muted hover:text-danger text-xs flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Project Title</Label>
                    <Input
                      value={proj.title}
                      onChange={(e) => updateProject(idx, { title: e.target.value })}
                      placeholder="e.g. Distributed Task Scheduler"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Technologies Used (comma separated)</Label>
                    <Input
                      value={proj.technologies.join(", ")}
                      onChange={(e) =>
                        updateProject(idx, {
                          technologies: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                        })
                      }
                      placeholder="e.g. React, Go, Redis, Docker"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Description &amp; Key Features</Label>
                  <Textarea
                    rows={2}
                    value={proj.description}
                    onChange={(e) => updateProject(idx, { description: e.target.value })}
                    placeholder="Describe problem solved, architecture, and measurable outcome..."
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">GitHub Repository URL</Label>
                    <Input
                      value={proj.githubUrl || ""}
                      onChange={(e) => updateProject(idx, { githubUrl: e.target.value })}
                      placeholder="https://github.com/..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Live Demo URL</Label>
                    <Input
                      value={proj.liveUrl || ""}
                      onChange={(e) => updateProject(idx, { liveUrl: e.target.value })}
                      placeholder="https://myproject.app"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Section 5: Experience & Internships */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-secondary" />
              <CardTitle className="text-base font-bold font-heading">
                5. Internships &amp; Work Experience
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Internships, practical research, and developer employment history.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addExperience}
            className="text-xs border-border gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Experience</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {experience.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-border rounded-xl space-y-2">
              <Briefcase className="h-8 w-8 text-text-muted mx-auto" />
              <p className="text-xs text-text-secondary">No work experience listed.</p>
              <Button type="button" variant="outline" size="sm" onClick={addExperience} className="text-xs">
                Add Internship or Role
              </Button>
            </div>
          ) : (
            experience.map((exp, idx) => (
              <div
                key={exp.id || idx}
                className="p-4 rounded-xl border border-border bg-surface/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary font-heading">
                    Experience #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExperience(idx)}
                    className="text-text-muted hover:text-danger text-xs flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Organization</Label>
                    <Input
                      value={exp.organization}
                      onChange={(e) => updateExperience(idx, { organization: e.target.value })}
                      placeholder="e.g. Acme Tech Solutions"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Designation / Role</Label>
                    <Input
                      value={exp.designation}
                      onChange={(e) => updateExperience(idx, { designation: e.target.value })}
                      placeholder="e.g. Frontend Engineering Intern"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Duration</Label>
                    <Input
                      value={exp.startDate}
                      onChange={(e) => updateExperience(idx, { startDate: e.target.value })}
                      placeholder="e.g. June 2025 - August 2025"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Key Contributions</Label>
                  <Textarea
                    rows={2}
                    value={exp.responsibilities.join("\n")}
                    onChange={(e) =>
                      updateExperience(idx, {
                        responsibilities: e.target.value.split("\n").filter(Boolean),
                      })
                    }
                    placeholder="List core contributions, technologies utilized, and team deliverables..."
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Section 6: Certifications */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-bold font-heading">
                6. Certifications &amp; Credentials
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Recognized certificates from cloud providers, institutions, and accredited platforms.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCertification}
            className="text-xs border-border gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Certification</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {certifications.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-border rounded-xl space-y-2">
              <Award className="h-8 w-8 text-text-muted mx-auto" />
              <p className="text-xs text-text-secondary">No certifications added yet.</p>
              <Button type="button" variant="outline" size="sm" onClick={addCertification} className="text-xs">
                Add AWS, Cloud, or Technical Certification
              </Button>
            </div>
          ) : (
            certifications.map((cert, idx) => (
              <div
                key={cert.id || idx}
                className="p-3.5 rounded-xl border border-border bg-surface/30 grid gap-3 sm:grid-cols-3 items-end"
              >
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Certificate Title</Label>
                  <Input
                    value={cert.name}
                    onChange={(e) => updateCertification(idx, { name: e.target.value })}
                    placeholder="e.g. AWS Certified Cloud Practitioner"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Issuing Body</Label>
                  <Input
                    value={cert.issuingOrganization}
                    onChange={(e) => updateCertification(idx, { issuingOrganization: e.target.value })}
                    placeholder="e.g. Amazon Web Services"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs font-medium">Credential URL</Label>
                    <Input
                      value={cert.credentialUrl || ""}
                      onChange={(e) => updateCertification(idx, { credentialUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCertification(idx)}
                    className="h-9 px-2 text-danger hover:bg-danger/10 rounded-md"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Section 7: Professional Links */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-secondary" />
            <CardTitle className="text-base font-bold font-heading">
              7. Online Presence &amp; Links
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Verify your open source contributions and professional network.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Linkedin className="h-3.5 w-3.5 text-primary" />
                <span>LinkedIn Profile</span>
              </Label>
              <Input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Github className="h-3.5 w-3.5 text-text-primary" />
                <span>GitHub Profile</span>
              </Label>
              <Input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-secondary" />
                <span>Personal Portfolio</span>
              </Label>
              <Input
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://myportfolio.dev"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save Action Bar */}
      <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">
            Completeness: <strong className="text-text-primary font-mono">{completeness.overallPercentage}%</strong>
          </span>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 px-6"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{saving ? "Saving Changes..." : "Save Career Profile"}</span>
        </Button>
      </div>

      {/* Interactive Profile Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold font-heading text-text-primary">
                  Professional Profile Preview
                </h3>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-text-muted hover:text-text-primary text-sm font-semibold"
              >
                Close &times;
              </button>
            </div>

            {/* Resume Style Document Layout */}
            <div className="p-6 rounded-xl bg-card-elevated border border-border/80 space-y-5">
              <div className="border-b border-border/60 pb-3">
                <h2 className="text-xl font-bold font-heading text-text-primary">{profile.fullName}</h2>
                <p className="text-xs text-secondary font-medium mt-0.5">{headline || "Candidate Profile"}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary mt-1.5">
                  <span>{profile.email}</span>
                  {phone && <span>{phone}</span>}
                  {location && <span>{location}</span>}
                </div>
              </div>

              {bio && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-text-primary">Summary</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">{bio}</p>
                </div>
              )}

              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-text-primary">Education</h4>
                <div className="text-xs flex justify-between">
                  <span className="font-semibold text-text-primary">{profile.degree} - {profile.departmentName}</span>
                  <span className="font-mono text-secondary">CGPA: {profile.cgpa.toFixed(2)}</span>
                </div>
              </div>

              {technicalSkills.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-text-primary">Technical Skills</h4>
                  <p className="text-xs text-text-secondary">
                    {technicalSkills.map((s) => s.name).join(", ")}
                  </p>
                </div>
              )}

              {projects.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-text-primary">Projects</h4>
                  {projects.map((p, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <div className="flex justify-between font-semibold text-text-primary">
                        <span>{p.title}</span>
                        <span className="text-[11px] font-mono text-text-muted">{p.technologies.join(", ")}</span>
                      </div>
                      <p className="text-[11px] text-text-secondary">{p.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setShowPreview(false)} className="text-xs">
                Back to Editing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
