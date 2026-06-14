export type ContactLink = {
    icon: string;
    label: string;
    value: string;
    href: string;
};

export type ResumeProject = {
    title: string;
    techStack: string;
    github?: string;
    period?: string;
    description: string;
    highlights: string[];
};

export type Experience = {
    company: string;
    role: string;
    period: string;
    highlights: string[];
};

export type Education = {
    school: string;
    badge?: string;
    achievements?: string[];
};

export type ResumeContent = {
    name: string;
    summary: string;
    contactLinks: ContactLink[];
    skills: string[];
    projects: ResumeProject[];
    experiences: Experience[];
    education: Education[];
};

export type ResumeVersion = {
    label: string;
    date: string;
    data: ResumeContent;
};
