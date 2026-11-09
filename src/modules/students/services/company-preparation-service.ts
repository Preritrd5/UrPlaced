/**
 * Company Preparation Service
 * 
 * Manages the Advanced Company-Specific Preparation Module:
 * - Structured profiles for premier campus hiring partners (TCS, Infosys, Wipro, Accenture, Cognizant, Amazon, Google, Microsoft, etc.)
 * - Configurable company roles, skill requirements, and preparation tracks
 * - Round-by-round preparation journey: Assessment, Technical Screening, Coding, Technical Interview, HR/STAR
 * - Student company preparation progress & saved companies
 * - Gemini AI company-oriented practice question generation with deterministic fallback
 * - Integrated launch into Phase 02 AI Mock Interview Studio (reusing the existing engine)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { GeminiClient } from "@/modules/ai/gemini-client";

export interface CompanyProfileData {
  id: string;
  name: string;
  slug: string;
  description: string;
  industry: string;
  websiteUrl?: string;
  logoUrl?: string;
  hiringWorkflow: {
    roundNumber: number;
    title: string;
    description: string;
    focusAreas: string[];
  }[];
  roles: {
    id: string;
    roleName: string;
    roleSlug: string;
    description?: string;
    requiredSkills: string[];
    preferredSkills: string[];
  }[];
  prepTracks: {
    id: string;
    trackName: string;
    description?: string;
    modules: {
      id: string;
      title: string;
      category: string;
      estimatedMinutes: number;
      description: string;
      keyTopics: string[];
    }[];
  }[];
  overviewNotes?: string;
  isSaved?: boolean;
  progressPercentage?: number;
  completedModulesCount?: number;
  totalModulesCount?: number;
}

// Canonical curated company profiles (indicative preparation guidance)
export const CURATED_COMPANIES: CompanyProfileData[] = [
  {
    id: "comp_tcs",
    name: "Tata Consultancy Services (TCS)",
    slug: "tcs",
    description: "Global IT services, consulting and business solutions leader. Campus recruitment through TCS NQT (National Qualifier Test) across Ninja and Digital cadres.",
    industry: "Information Technology & Services",
    websiteUrl: "https://www.tcs.com",
    hiringWorkflow: [
      {
        roundNumber: 1,
        title: "TCS NQT Online Cognitive & Technical Test",
        description: "Standardized test assessing Numerical Ability, Reasoning Ability, Verbal Ability, and Hands-on Coding.",
        focusAreas: ["Arithmetic Reasoning", "Data Interpretation", "Reading Comprehension", "Basic Algorithms"],
      },
      {
        roundNumber: 2,
        title: "Technical Interview",
        description: "In-depth review of academic projects, OOP fundamentals, DBMS queries, and basic data structures.",
        focusAreas: ["OOP Concepts", "SQL Joins & Normalization", "Academic Projects", "Languages (Java/Python/C++)"],
      },
      {
        roundNumber: 3,
        title: "Managerial & HR Interview",
        description: "Cultural fit, adaptability to shifts and relocations, communication, and situational handling.",
        focusAreas: ["Situational Handling", "Work Relocation Willingness", "Communication & Teamwork"],
      },
    ],
    roles: [
      {
        id: "role_tcs_ninja",
        roleName: "Ninja Software Engineer",
        roleSlug: "ninja-software-engineer",
        description: "Foundational software engineering role focusing on enterprise application development, testing, and system maintenance.",
        requiredSkills: ["Java", "SQL", "OOP", "Data Structures"],
        preferredSkills: ["Cloud Basics", "Linux", "Python"],
      },
      {
        id: "role_tcs_digital",
        roleName: "Digital Cadre Engineer",
        roleSlug: "digital-engineer",
        description: "Advanced engineering role for digital technologies: Cloud, AI/ML, Fullstack, and Cybersecurity.",
        requiredSkills: ["Algorithms", "Python", "Full Stack Development", "Database Optimization"],
        preferredSkills: ["Microservices", "Docker", "Machine Learning"],
      },
    ],
    prepTracks: [
      {
        id: "track_tcs_nqt",
        trackName: "TCS Comprehensive Preparation Track",
        description: "Full end-to-end preparation for TCS NQT cognitive assessments and technical rounds.",
        modules: [
          {
            id: "mod_tcs_1",
            title: "NQT Foundation Aptitude Mastery",
            category: "ASSESSMENT",
            estimatedMinutes: 60,
            description: "Practice percentages, time-speed-distance, and data interpretation patterns frequent in NQT.",
            keyTopics: ["Percentages", "Time & Work", "Number Systems"],
          },
          {
            id: "mod_tcs_2",
            title: "TCS Technical Screening & SQL",
            category: "TECHNICAL",
            estimatedMinutes: 45,
            description: "Core SQL queries, normalization, ACID properties, and basic pointer/reference concepts.",
            keyTopics: ["SQL Joins", "Indexing", "OOP Encapsulation"],
          },
          {
            id: "mod_tcs_3",
            title: "Hands-on Coding Solutions",
            category: "CODING",
            estimatedMinutes: 60,
            description: "Array manipulation, string parsing, and matrix operations common in NQT hands-on section.",
            keyTopics: ["Array Rotation", "Anagrams", "Palindrome Substrings"],
          },
          {
            id: "mod_tcs_4",
            title: "TCS Project & Tech Interview Defense",
            category: "INTERVIEW",
            estimatedMinutes: 40,
            description: "Prepare concise 3-minute technical project walkthroughs and architectural decision defenses.",
            keyTopics: ["Project Architecture", "Database Schema Choice", "Error Handling"],
          },
          {
            id: "mod_tcs_5",
            title: "HR Behavioral & STAR Scenarios",
            category: "HR",
            estimatedMinutes: 30,
            description: "Relocation readiness, handling tight deadlines, and situational teamwork questions.",
            keyTopics: ["STAR Method", "Conflict Resolution", "Career Aspirations"],
          },
        ],
      },
    ],
    overviewNotes: "Indicative campus hiring guidance based on public curriculum patterns and general industry recruiting workflows.",
  },
  {
    id: "comp_infosys",
    name: "Infosys",
    slug: "infosys",
    description: "Multinational information technology company providing business consulting, information technology, and outsourcing services.",
    industry: "Information Technology & Services",
    websiteUrl: "https://www.infosys.com",
    hiringWorkflow: [
      {
        roundNumber: 1,
        title: "Infosys Online Assessment",
        description: "Reasoning Ability, Mathematical Ability, Verbal Ability, Pseudocode, and Puzzle Solving.",
        focusAreas: ["Cryptarithmetic", "Pseudocode Analysis", "Syllogisms", "Critical Verbal Reasoning"],
      },
      {
        roundNumber: 2,
        title: "Technical Interview",
        description: "Evaluation of code logic, data structures, algorithms, and DBMS fundamentals.",
        focusAreas: ["Arrays & Linked Lists", "Searching & Sorting", "SQL Group By / Having"],
      },
      {
        roundNumber: 3,
        title: "HR Interview",
        description: "Discussion regarding academic background, soft skills, and flexibility.",
        focusAreas: ["Self-Introduction", "Strengths & Weaknesses", "Company Knowledge"],
      },
    ],
    roles: [
      {
        id: "role_infosys_se",
        roleName: "Systems Engineer",
        roleSlug: "systems-engineer",
        description: "Develops and tests applications, works on enterprise frameworks, and maintains digital workflows.",
        requiredSkills: ["Java", "Python", "SQL", "Data Structures"],
        preferredSkills: ["Spring Boot", "Git", "React"],
      },
      {
        id: "role_infosys_sp",
        roleName: "Specialist Programmer",
        roleSlug: "specialist-programmer",
        description: "High-performance coding role working on complex algorithmic problems, architecture, and cloud platforms.",
        requiredSkills: ["Advanced DSA", "Dynamic Programming", "Graph Theory", "System Design"],
        preferredSkills: ["Cloud Native", "Kubernetes", "Distributed Systems"],
      },
    ],
    prepTracks: [
      {
        id: "track_infosys_prep",
        trackName: "Infosys Placement Preparation Track",
        description: "Targeted track covering Pseudocode, Cryptarithmetic puzzles, and Java/OOP interview drills.",
        modules: [
          {
            id: "mod_inf_1",
            title: "Pseudocode & Logic Tracing",
            category: "ASSESSMENT",
            estimatedMinutes: 45,
            description: "Practice bitwise operators, recursive call tracing, and loop condition analysis.",
            keyTopics: ["Bitwise Operations", "Recursion Trees", "Operator Precedence"],
          },
          {
            id: "mod_inf_2",
            title: "Cryptarithmetic & Puzzle Solving",
            category: "ASSESSMENT",
            estimatedMinutes: 45,
            description: "Master carry-over rules and digit deduction strategies for mathematical puzzles.",
            keyTopics: ["Letter-Digit Mapping", "Carry-over Theorems", "Constraint Elimination"],
          },
          {
            id: "mod_inf_3",
            title: "Core Java & OOP Fundamentals",
            category: "TECHNICAL",
            estimatedMinutes: 50,
            description: "Polymorphism, Interfaces vs Abstract classes, Exception hierarchies, and Collections framework.",
            keyTopics: ["Method Overloading/Overriding", "HashMap Internals", "Checked Exceptions"],
          },
          {
            id: "mod_inf_4",
            title: "Technical Project Discussion",
            category: "INTERVIEW",
            estimatedMinutes: 40,
            description: "Structure clear explanations of project workflow, ER diagrams, and technology trade-offs.",
            keyTopics: ["Database Schema", "REST API Design", "Authentication Flow"],
          },
        ],
      },
    ],
    overviewNotes: "Indicative preparation guidance focused on standardized university placement patterns.",
  },
  {
    id: "comp_accenture",
    name: "Accenture",
    slug: "accenture",
    description: "Leading global professional services company with leading capabilities in digital, cloud, and security.",
    industry: "Management Consulting & Technology Services",
    websiteUrl: "https://www.accenture.com",
    hiringWorkflow: [
      {
        roundNumber: 1,
        title: "Cognitive & Technical Assessment",
        description: "English Ability, Critical Reasoning, Abstract Reasoning, Common Applications, MS Office, and Networking.",
        focusAreas: ["Cloud Fundamentals", "Network Security", "Critical Reasoning", "Pseudocode"],
      },
      {
        roundNumber: 2,
        title: "Coding Assessment",
        description: "Hands-on coding questions evaluated across multiple languages.",
        focusAreas: ["String Algorithms", "Matrix Operations", "Number Theory"],
      },
      {
        roundNumber: 3,
        title: "Interview (Technical + HR)",
        description: "Discussion on project contributions, adaptability, problem-solving, and professional communication.",
        focusAreas: ["Project Problem Statement", "Scenario Resolution", "Teamwork"],
      },
    ],
    roles: [
      {
        id: "role_accenture_ase",
        roleName: "Associate Software Engineer",
        roleSlug: "associate-software-engineer",
        description: "Design, build, test and deploy software applications in digital environments.",
        requiredSkills: ["Programming Fundamentals", "SQL", "Web Basics", "Problem Solving"],
        preferredSkills: ["Cloud Fundamentals", "Agile", "DevOps"],
      },
    ],
    prepTracks: [
      {
        id: "track_accenture_ase",
        trackName: "Accenture ASE Preparation Track",
        description: "Preparation for Cognitive, Pseudocode, Cloud basics, and hands-on interview review.",
        modules: [
          {
            id: "mod_acc_1",
            title: "Common Applications & Cloud Security",
            category: "ASSESSMENT",
            estimatedMinutes: 40,
            description: "Review IP addressing, OSI model layers, cloud deployment models, and MS Office utilities.",
            keyTopics: ["OSI Model", "Subnetting", "SaaS/PaaS/IaaS", "Cloud Security Basics"],
          },
          {
            id: "mod_acc_2",
            title: "Pseudocode & Algorithm Tracing",
            category: "TECHNICAL",
            estimatedMinutes: 45,
            description: "Trace variable scopes, nested conditional statements, and recursive exits.",
            keyTopics: ["Variable Scope", "Condition Evaluation", "Array Traversals"],
          },
          {
            id: "mod_acc_3",
            title: "Applied Coding Practice",
            category: "CODING",
            estimatedMinutes: 50,
            description: "Practice common coding test patterns: string transformations, binary conversions, and sums.",
            keyTopics: ["String Parsing", "Digit Logic", "Two Pointers"],
          },
          {
            id: "mod_acc_4",
            title: "Behavioral & Competency Interview",
            category: "HR",
            estimatedMinutes: 30,
            description: "Formulate structured responses for collaborative conflict, learning new tech stacks, and ethics.",
            keyTopics: ["Agile Teamwork", "Continuous Learning", "STAR Storytelling"],
          },
        ],
      },
    ],
    overviewNotes: "Indicative guidance for campus technical hiring drives.",
  },
  {
    id: "comp_amazon",
    name: "Amazon",
    slug: "amazon",
    description: "Multinational technology company focusing on e-commerce, cloud computing (AWS), digital streaming, and artificial intelligence.",
    industry: "Internet & Technology",
    websiteUrl: "https://www.amazon.com",
    hiringWorkflow: [
      {
        roundNumber: 1,
        title: "Online Assessment (OA)",
        description: "2 algorithmic coding questions, system work style survey, and work simulation.",
        focusAreas: ["Data Structures", "Dynamic Programming", "Graphs", "Leadership Principles"],
      },
      {
        roundNumber: 2,
        title: "Technical Interview Rounds (1-3)",
        description: "Live coding on shared editor, algorithmic complexity analysis, and Leadership Principle evaluation.",
        focusAreas: ["Trees & Graphs", "Hash Maps & Heaps", "Customer Obsession", "Ownership"],
      },
    ],
    roles: [
      {
        id: "role_amazon_sde",
        roleName: "Software Development Engineer (SDE-1)",
        roleSlug: "sde-1",
        description: "Build distributed, highly scalable customer-facing software systems and cloud services.",
        requiredSkills: ["DSA", "Java or C++", "Object-Oriented Design", "System Architecture Basics"],
        preferredSkills: ["AWS", "NoSQL", "Distributed Systems"],
      },
    ],
    prepTracks: [
      {
        id: "track_amazon_sde",
        trackName: "Amazon SDE-1 Preparation Track",
        description: "Rigorous algorithmic problem solving and Amazon Leadership Principles integration.",
        modules: [
          {
            id: "mod_amz_1",
            title: "Algorithmic Mastery: Trees & Graphs",
            category: "CODING",
            estimatedMinutes: 75,
            description: "Master BFS, DFS, Dijkstra, topological sort, and lowest common ancestor algorithms.",
            keyTopics: ["Breadth-First Search", "Depth-First Search", "Shortest Path", "Tree Traversals"],
          },
          {
            id: "mod_amz_2",
            title: "Dynamic Programming & Optimization",
            category: "CODING",
            estimatedMinutes: 75,
            description: "Subproblem memoization, bottom-up tabulations, and knapsack problem variations.",
            keyTopics: ["0/1 Knapsack", "Longest Common Subsequence", "Coin Change"],
          },
          {
            id: "mod_amz_3",
            title: "Object-Oriented Design (LLD)",
            category: "TECHNICAL",
            estimatedMinutes: 60,
            description: "Design modular systems (e.g. Parking Lot, Movie Ticket Booking) applying SOLID principles.",
            keyTopics: ["SOLID Principles", "Design Patterns", "Class Diagrams"],
          },
          {
            id: "mod_amz_4",
            title: "Amazon Leadership Principles Defense",
            category: "HR",
            estimatedMinutes: 45,
            description: "Prepare 2 concrete stories per key principle: Customer Obsession, Ownership, Bias for Action.",
            keyTopics: ["Customer Obsession", "Ownership", "Invent & Simplify", "Deliver Results"],
          },
        ],
      },
    ],
    overviewNotes: "Guidance curated from public university recruiting patterns and standard engineering benchmarks.",
  },
];

export class CompanyPreparationService {
  /**
   * Retrieves all company profiles, merging persisted student progress
   */
  static async getCompanyProfiles(
    tenantId: string,
    studentId: string,
    filters?: { industry?: string; search?: string }
  ): Promise<CompanyProfileData[]> {
    const supabase = createAdminClient();

    // Fetch student's persisted progress records
    let progressMap = new Map<string, { completedModuleIds: string[]; isSaved: boolean }>();
    try {
      const { data: progressList } = await supabase
        .from("student_company_prep_progress")
        .select("company_id, completed_module_ids, is_saved_for_later")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId);

      if (progressList) {
        progressList.forEach((p: any) => {
          progressMap.set(p.company_id, {
            completedModuleIds: p.completed_module_ids || [],
            isSaved: p.is_saved_for_later || false,
          });
        });
      }
    } catch {
      // Use empty progress map on fresh/unmigrated table
    }

    let companies = [...CURATED_COMPANIES];

    if (filters?.industry && filters.industry !== "ALL") {
      companies = companies.filter((c) =>
        c.industry.toLowerCase().includes(filters.industry!.toLowerCase())
      );
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const q = filters.search.toLowerCase().trim();
      companies = companies.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q) ||
          c.roles.some((r) => r.roleName.toLowerCase().includes(q))
      );
    }

    return companies.map((c) => {
      const prog = progressMap.get(c.id);
      const totalModules = c.prepTracks.reduce(
        (acc, t) => acc + (t.modules ? t.modules.length : 0),
        0
      );
      const completedModules = prog?.completedModuleIds?.length || 0;
      const progressPercentage =
        totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

      return {
        ...c,
        isSaved: prog?.isSaved || false,
        completedModulesCount: completedModules,
        totalModulesCount: totalModules,
        progressPercentage,
      };
    });
  }

  /**
   * Retrieves a specific company profile by slug
   */
  static async getCompanyBySlug(
    tenantId: string,
    studentId: string,
    slug: string
  ): Promise<CompanyProfileData | null> {
    const companies = await this.getCompanyProfiles(tenantId, studentId);
    const found = companies.find((c) => c.slug.toLowerCase() === slug.toLowerCase());
    return found || null;
  }

  /**
   * Toggles save-for-later state on a company profile
   */
  static async toggleSaveCompany(
    tenantId: string,
    studentId: string,
    companyId: string,
    isSaved: boolean
  ): Promise<boolean> {
    const supabase = createAdminClient();

    try {
      await supabase.from("student_company_prep_progress").upsert(
        {
          tenant_id: tenantId,
          student_id: studentId,
          company_id: companyId,
          is_saved_for_later: isSaved,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,company_id" }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Marks a specific preparation module as completed for a company track
   */
  static async markModuleProgress(
    tenantId: string,
    studentId: string,
    companyId: string,
    moduleId: string,
    isCompleted: boolean
  ): Promise<{ completedCount: number; progressPercentage: number }> {
    const supabase = createAdminClient();

    let currentModules: string[] = [];

    try {
      const { data } = await supabase
        .from("student_company_prep_progress")
        .select("completed_module_ids")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (data?.completed_module_ids) {
        currentModules = data.completed_module_ids;
      }
    } catch {
      // Continue
    }

    if (isCompleted) {
      if (!currentModules.includes(moduleId)) {
        currentModules.push(moduleId);
      }
    } else {
      currentModules = currentModules.filter((id) => id !== moduleId);
    }

    const company = CURATED_COMPANIES.find((c) => c.id === companyId);
    const totalModules = company
      ? company.prepTracks.reduce((acc, t) => acc + (t.modules?.length || 0), 0)
      : 5;
    const progressPercentage =
      totalModules > 0 ? Math.round((currentModules.length / totalModules) * 100) : 0;

    try {
      await supabase.from("student_company_prep_progress").upsert(
        {
          tenant_id: tenantId,
          student_id: studentId,
          company_id: companyId,
          completed_module_ids: currentModules,
          overall_progress_percentage: progressPercentage,
          last_practiced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,company_id" }
      );
    } catch {
      // Continue
    }

    return {
      completedCount: currentModules.length,
      progressPercentage,
    };
  }

  /**
   * Generates AI company practice questions using Gemini with graceful deterministic fallback
   */
  static async generateCompanyPracticeQuestions(params: {
    companyName: string;
    roleName: string;
    topic: string;
    difficulty: string;
  }): Promise<{
    isAIGenerated: boolean;
    questions: {
      questionText: string;
      questionType: string;
      options?: string[];
      correctAnswer: string;
      explanation: string;
      solvingTips: string;
    }[];
  }> {
    const systemPrompt = `You are a campus placement preparation expert for ${params.companyName}.
Generate 3 practice questions for the role "${params.roleName}" focusing on "${params.topic}".
Difficulty: ${params.difficulty}.

Format the response strictly as valid JSON adhering to:
{
  "questions": [
    {
      "questionText": "Clear question statement",
      "questionType": "MCQ",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "A",
      "explanation": "Detailed explanation of why this is correct",
      "solvingTips": "Best practice solving tip for campus placement"
    }
  ]
}
Do not claim these are confidential actual exam leaks; label them purely as illustrative practice questions.`;

    try {
      const response = await GeminiClient.generate({
        prompt: `Generate 3 high-yield practice questions for ${params.companyName} - ${params.roleName} on ${params.topic}`,
        systemInstruction: systemPrompt,
        temperature: 0.2,
        feature: "COMPANY_PREPARATION",
      });

      if (response && response.text) {
        let cleanJson = response.text.trim();
        if (cleanJson.startsWith("```json")) cleanJson = cleanJson.substring(7);
        if (cleanJson.endsWith("```")) cleanJson = cleanJson.slice(0, -3);
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return {
            isAIGenerated: true,
            questions: parsed.questions,
          };
        }
      }
    } catch {
      // Graceful fallback to curated questions
    }

    // Deterministic rule-based fallback questions
    return {
      isAIGenerated: false,
      questions: [
        {
          questionText: `What is the primary architectural trade-off when implementing a relational database versus a document store for ${params.roleName} workflows at ${params.companyName}?`,
          questionType: "MCQ",
          options: [
            "A. Strict ACID transaction guarantees vs Flexible schema and horizontal scalability",
            "B. Lower memory usage vs Zero disk storage requirement",
            "C. Compulsory synchronous replication vs Inability to index fields",
            "D. Elimination of network latency vs Mandatory single-core CPU execution",
          ],
          correctAnswer: "A",
          explanation: "Relational databases provide strong consistency and ACID guarantees via structured schemas and foreign keys, whereas document stores trade strict transactional consistency for horizontal partition tolerance and dynamic schema flexibility.",
          solvingTips: "Focus on the CAP theorem and trade-offs between consistency and partition tolerance.",
        },
        {
          questionText: `In a multi-threaded enterprise application, what mechanism prevents deadlock when multiple resources must be acquired simultaneously?`,
          questionType: "MCQ",
          options: [
            "A. Enforcing a global total ordering on resource acquisition",
            "B. Allocating maximum thread pool size to infinity",
            "C. Disabling garbage collection during critical sections",
            "D. Replacing mutexes with unconditional infinite busy-waiting",
          ],
          correctAnswer: "A",
          explanation: "Deadlock circular wait can be formally prevented by establishing a strict global total ordering across all shared resources and requiring every thread to acquire locks only in increasing order.",
          solvingTips: "Remember Coffman's circular wait condition: break circular wait by consistent lock ordering.",
        },
      ],
    };
  }
}
