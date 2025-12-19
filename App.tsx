import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, MessageSquare, User as UserIcon, Home, ChevronLeft, ArrowRight,
  ShieldCheck, CheckCircle, FileText, Clock, Briefcase, MapPin, Calendar,
  X, Upload, Camera, Mail, Lock, ScanFace, Bookmark, BookmarkCheck,
  ClipboardList, AlertCircle, Loader2, FileCheck, Trophy, MessageCircle,
  Info, TextQuote, Target, PlusCircle, Users, Eye, Check, Ban, Bell,
  ExternalLink, Shield, Database, LogIn, Phone, Trash2, CalendarDays,
  ListPlus, MinusCircle
} from 'lucide-react';
import { Job, Application, JobType, ApplicationStatus, UserRole, RequirementDetail } from './types';
import { supabase, isMockMode } from './lib/supabase';
import { hashDocument } from './services/blockchainService';
import { MOCK_JOBS, MOCK_USER, MOCK_EMPLOYER, SECTORS } from './constants';

type View = 'role_selection' | 'login' | 'onboarding' | 'face_setup' | 'feed' | 'job_details' | 'apply' | 'verifying' | 'ready_to_submit' | 'tracking' | 'profile' | 'chat' | 'employer_dashboard' | 'post_job' | 'view_applicants';

const App: React.FC = () => {
  // Authentication & Session State
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userData, setUserData] = useState({ username: '', email: '', password: '', company: '' });
  const [profile, setProfile] = useState<any>(null);
  
  // Navigation State
  const [activeView, setActiveView] = useState<View>('role_selection');
  
  // Data State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<JobType | 'All' | 'Saved'>('All');
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationDraft, setApplicationDraft] = useState<Record<string, { file: File, name: string, hash: string }>>({});
  
  // Post Job State
  const [newJob, setNewJob] = useState({
    title: '',
    type: 'Full-time' as JobType,
    workplace: '',
    salary: '',
    sector: 'Technology',
    workingHours: '',
    description: '',
    roleDetails: '',
    contactPhone: '',
    endDate: '',
    requirements: [
      { name: 'CV / Resume', why: 'Professional background', instruction: 'PDF format required.' },
      { name: 'ID / Passport', why: 'Identity verification', instruction: 'Clear scan.' }
    ] as RequirementDetail[]
  });

  // UI State
  const [viewingDoc, setViewingDoc] = useState<{ app: Application, docName: string, fileName: string } | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeReqName, setActiveReqName] = useState<string | null>(null);

  // Utility for clean error messages
  const getErrorMessage = (error: any): string => {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    
    // Construct readable message from Supabase/Postgres error object
    const parts = [];
    if (error.message) parts.push(error.message);
    if (error.details) parts.push(error.details);
    if (error.hint) parts.push(`(${error.hint})`);
    
    if (parts.length > 0) return parts.join(' ');
    
    // Fallback for objects without standard message fields
    try {
      return JSON.stringify(error);
    } catch (e) {
      return 'Error object';
    }
  };

  // Initialize Supabase Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        // If we have a session on load, we try to sync state
        handleAuthSuccess(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        // Only trigger automatic profile fetch if we aren't already handling a manual login transition
        fetchProfileAndSync(session.user, false); 
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Centralized Logic to handle what happens when a user is confirmed Authenticated.
   */
  const handleAuthSuccess = async (user: any) => {
    await fetchProfileAndSync(user, true);
  };

  const fetchProfileAndSync = async (user: any, shouldRedirect: boolean) => {
    const userId = user.id;
    const metadata = user.user_metadata || {};

    // 1. Fetch DB Profile
    const { data: dbData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    
    // 2. Construct Effective Profile
    const effectiveProfile = {
      id: userId,
      role: (dbData?.role || metadata.role || 'candidate') as UserRole,
      full_name: dbData?.full_name || metadata.full_name || user.email,
      company_name: dbData?.company_name || metadata.company_name || '',
      is_verified: dbData?.is_verified || metadata.is_verified || false
    };

    // 3. Background Sync (If DB is missing data that Metadata has)
    // We use a safe check here instead of blind upsert to avoid RLS noise in console
    if (!dbData) {
       // Only try to insert if we are sure it's missing.
       // Note: This might still fail if RLS prevents INSERT, but that's expected for some configs.
       supabase.from('profiles').insert({
         id: userId,
         role: effectiveProfile.role,
         full_name: effectiveProfile.full_name,
         company_name: effectiveProfile.company_name,
         is_verified: effectiveProfile.is_verified
       }).then(({ error }) => {
         if (error && !error.message.includes('duplicate')) {
             console.log("Background profile sync info:", getErrorMessage(error));
         }
       });
    }

    // 4. Update React State
    setProfile(effectiveProfile);
    setUserRole(effectiveProfile.role);
    setSession({ user });

    // 5. Redirect if requested
    if (shouldRedirect) {
        setActiveView(effectiveProfile.role === 'employer' ? 'employer_dashboard' : 'feed');
    }

    // 6. Start fetching data
    fetchInitialData(effectiveProfile.role, userId);
  };

  const fetchInitialData = async (role: string, userId: string) => {
    // Jobs - matches 'jobs' table columns
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (jobsData && jobsData.length > 0) {
      const mappedJobs: Job[] = jobsData.map((j: any) => ({
        id: j.id,
        employerId: j.employer_id, // maps to employer_id in DB
        title: j.title,
        company: j.company,
        workplace: j.workplace,
        type: j.type,
        sector: j.sector,
        salary: j.salary,
        workingHours: j.working_hours, // maps to working_hours in DB
        requirements: j.requirements || [], // maps to requirements (jsonb)
        description: j.description,
        roleDetails: j.role_details, // maps to role_details in DB
        postedAt: j.posted_at,
        endDate: j.end_date,
        contactEmail: j.contact_email, // maps to contact_email
        contactPhone: j.contact_phone || '' // maps to contact_phone
      }));
      setJobs(mappedJobs);
    } else {
      setJobs(MOCK_JOBS);
    }

    // Applications - matches 'applications' table
    let query;
    if (role === 'candidate') {
      query = supabase.from('applications').select('*, jobs(*)').eq('candidate_id', userId);
    } else {
      // Fetch applications for jobs posted by this employer
      // Relies on foreign key applications.job_id -> jobs.id
      query = supabase.from('applications').select('*, jobs!inner(*)').eq('jobs.employer_id', userId);
    }
    
    const { data: appsData, error: appsError } = await query;
    
    if (appsError) {
       console.warn("Application fetch info:", getErrorMessage(appsError));
       // Fallback for tricky RLS situations
       if (role === 'employer') {
           const { data: myJobs } = await supabase.from('jobs').select('id').eq('employer_id', userId);
           const jobIds = myJobs?.map(j => j.id) || [];
           if (jobIds.length > 0) {
               const { data: fallbackApps } = await supabase.from('applications').select('*').in('job_id', jobIds);
               if (fallbackApps) {
                   const mappedApps: Application[] = (fallbackApps as any[]).map(a => ({
                        id: a.id,
                        jobId: a.job_id,
                        candidateId: a.candidate_id,
                        status: a.status,
                        uploadedDocs: a.uploaded_docs,
                        submittedAt: a.submitted_at,
                        verified: a.verified,
                        candidateName: a.candidate_name
                   }));
                   setApplications(mappedApps);
               }
           }
       }
    } else if (appsData) {
      const mappedApps: Application[] = (appsData as any[]).map(a => ({
        id: a.id,
        jobId: a.job_id,
        candidateId: a.candidate_id,
        status: a.status,
        uploadedDocs: a.uploaded_docs, // maps to uploaded_docs (jsonb)
        submittedAt: a.submitted_at,
        verified: a.verified,
        candidateName: a.candidate_name
      }));
      setApplications(mappedApps);
    }
  };

  useEffect(() => {
    if (session && userRole) {
      const interval = setInterval(() => fetchInitialData(userRole, session.user.id), 10000);
      return () => clearInterval(interval);
    }
  }, [session, userRole]);

  const handleLogin = async () => {
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: userData.password,
    });

    if (error) {
      alert(getErrorMessage(error));
      setAuthLoading(false);
      return;
    }

    if (data.user) {
      await handleAuthSuccess(data.user);
    }
    setAuthLoading(false);
  };

  const handleOnboardingSubmit = async () => {
    setAuthLoading(true);
    // 1. Sign Up
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: { 
        data: { 
          full_name: userData.username, 
          role: userRole,
          company_name: userData.company
        } 
      }
    });

    if (error) {
      setAuthLoading(false);
      if (error.message && error.message.includes('already registered')) {
        alert("Account already exists. Please Sign In.");
        setActiveView('login');
      } else {
        alert(getErrorMessage(error));
      }
      return;
    }

    if (data.user) {
      // Direct Insert on signup - safest approach
      const { error: pError } = await supabase.from('profiles').insert({
          id: data.user.id,
          role: userRole,
          full_name: userData.username,
          company_name: userData.company,
          is_verified: true
      });
      
      if (pError) console.warn("Profile creation warning:", getErrorMessage(pError));

      setSession({ user: data.user });
      
      if (!data.session) {
         alert("Verification email sent! You can verify later.");
      }
      
      setActiveView('face_setup');
    }
    setAuthLoading(false);
  };

  const handlePostJob = async () => {
    if (!session?.user) return;
    
    // Validation
    if (!newJob.title || !newJob.workplace || !newJob.salary || !newJob.workingHours) {
        alert("Please fill in all required fields (Title, Workplace, Salary, Hours).");
        return;
    }

    setIsSubmittingJob(true);

    const userId = session.user.id;
    let resolvedCompany = userData.company || profile?.company_name || session.user.user_metadata?.company_name || 'Hiring Company';

    // 1. Ensure Profile Exists in DB (Satisfy FK constraint)
    // We separate checking from updating to avoid aggressive RLS blocking errors.
    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    
    if (!existingProfile) {
         // Profile missing, try to insert
         const { error: insertError } = await supabase.from('profiles').insert({
             id: userId,
             role: userRole || 'employer',
             full_name: profile?.full_name || userData.username || session.user.email,
             company_name: resolvedCompany,
             is_verified: true
         });

         if (insertError) {
              console.error(`Profile creation error: ${getErrorMessage(insertError)}`);
         }
    } else {
         // Profile exists, attempt update for consistency (optional)
         // Only update if strictly necessary to avoid RLS update policies
         if (resolvedCompany && resolvedCompany !== 'Hiring Company') {
            const { error: updateError } = await supabase.from('profiles').update({
                company_name: resolvedCompany,
            }).eq('id', userId);

            if (updateError) {
                // Log warning but proceed, as the row exists for FK
                console.warn(`Profile update warning: ${getErrorMessage(updateError)}`);
            }
         }
    }

    // 2. Prepare Payload matching DB Schema perfectly (snake_case)
    const jobPayload = {
      employer_id: userId,
      title: newJob.title,
      company: resolvedCompany,
      workplace: newJob.workplace,
      type: newJob.type,
      sector: newJob.sector,
      salary: newJob.salary,
      working_hours: newJob.workingHours, // DB column: working_hours
      description: newJob.description,
      role_details: newJob.roleDetails,   // DB column: role_details
      requirements: newJob.requirements,  // DB column: requirements (jsonb)
      posted_at: new Date().toISOString(),
      end_date: newJob.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      contact_email: session.user.email,  // DB column: contact_email
      contact_phone: newJob.contactPhone || null // DB column: contact_phone
    };

    // 3. Insert
    const { error } = await supabase.from('jobs').insert(jobPayload);

    if (error) {
      console.error(`Job Post Error: ${getErrorMessage(error)}`);
      alert('Failed to post job. ' + getErrorMessage(error));
    } else {
      // Reset State
      setNewJob({
        title: '',
        type: 'Full-time',
        workplace: '',
        salary: '',
        sector: 'Technology',
        workingHours: '',
        description: '',
        roleDetails: '',
        contactPhone: '',
        endDate: '',
        requirements: [
          { name: 'CV / Resume', why: 'Professional background', instruction: 'PDF format required.' },
          { name: 'ID / Passport', why: 'Identity verification', instruction: 'Clear scan.' }
        ]
      });
      await fetchInitialData('employer', userId);
      setActiveView('employer_dashboard');
    }
    setIsSubmittingJob(false);
  };

  const handleAddRequirement = () => {
    setNewJob({
      ...newJob,
      requirements: [...newJob.requirements, { name: '', why: '', instruction: '' }]
    });
  };

  const handleUpdateRequirement = (index: number, field: keyof RequirementDetail, value: string) => {
    const updated = [...newJob.requirements];
    updated[index] = { ...updated[index], [field]: value };
    setNewJob({ ...newJob, requirements: updated });
  };

  const handleRemoveRequirement = (index: number) => {
    const updated = [...newJob.requirements];
    updated.splice(index, 1);
    setNewJob({ ...newJob, requirements: updated });
  };

  const handleDeleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to remove this job posting? This action cannot be undone.")) return;
    
    const { error } = await supabase
      .from('jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', jobId);

    if (error) {
      alert("Error deleting job: " + getErrorMessage(error));
    } else {
      fetchInitialData('employer', session.user.id);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && activeReqName) {
      const hash = await hashDocument(file);
      setApplicationDraft(prev => ({ ...prev, [activeReqName!]: { file, name: file.name, hash } }));
      setActiveReqName(null);
    }
  };

  const triggerUpload = (reqName: string) => {
    setActiveReqName(reqName);
    fileInputRef.current?.click();
  };

  const removeFile = (reqName: string) => {
    setApplicationDraft(prev => {
      const next = { ...prev };
      delete next[reqName];
      return next;
    });
  };

  const finalizeSubmission = async () => {
    if (!selectedJob || !session) return;
    setIsVerifying(true);

    const docMap: Record<string, string> = {};
    for (const [reqName, draft] of Object.entries(applicationDraft)) {
      const fileName = `${session.user.id}/${Date.now()}_${draft.name}`;
      const { data, error } = await supabase.storage.from('documents').upload(fileName, draft.file);
      if (!error || !process.env.SUPABASE_URL) docMap[reqName] = fileName;
    }

    // Ensure Candidate Profile Exists (Safe pattern)
    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', session.user.id).maybeSingle();
    
    if (!existingProfile) {
        const { error: insertError } = await supabase.from('profiles').insert({
            id: session.user.id,
            role: 'candidate',
            full_name: profile?.full_name || userData.username || session.user.email,
            company_name: '', 
            is_verified: true
        });
        if (insertError) console.warn("Profile insert warning:", getErrorMessage(insertError));
    }

    // Insert into 'applications' table
    const { data, error } = await supabase.from('applications').insert({
      job_id: selectedJob.id,
      candidate_id: session.user.id,
      candidate_name: profile?.full_name || userData.username,
      status: 'pending',
      uploaded_docs: docMap,
      verified: true,
      submitted_at: new Date().toISOString()
    }).select().single();

    if (!error) {
       const rawData = data as any;
       const newApp: Application = {
        id: rawData.id,
        jobId: rawData.job_id || selectedJob.id,
        candidateId: rawData.candidate_id || session.user.id,
        status: rawData.status || 'pending',
        uploadedDocs: rawData.uploaded_docs || docMap,
        submittedAt: rawData.submitted_at || new Date().toISOString(),
        verified: rawData.verified,
        candidateName: rawData.candidate_name || profile?.full_name
      };

      setApplications(prev => [newApp, ...prev]);
      setActiveView('tracking');
      setApplicationDraft({});
    } else {
        if (!process.env.SUPABASE_URL) {
            setApplications(prev => [{
                id: 'mock_app_' + Date.now(),
                jobId: selectedJob.id,
                candidateId: session.user.id,
                status: 'pending',
                uploadedDocs: docMap,
                submittedAt: new Date().toISOString(),
                verified: true,
                candidateName: profile?.full_name
            }, ...prev]);
            setActiveView('tracking');
            setApplicationDraft({});
        } else {
            alert('Failed to submit application: ' + getErrorMessage(error));
        }
    }
    setIsVerifying(false);
  };

  const updateApplicationStatus = async (appId: string, newStatus: ApplicationStatus) => {
    const { error } = await supabase.from('applications').update({ status: newStatus }).eq('id', appId);
    if (!error) {
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    } else {
        alert('Failed to update status: ' + getErrorMessage(error));
    }
  };

  const startIdentityVerification = async (targetView: View) => {
    setIsVerifying(true);
    setActiveView('verifying');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setTimeout(() => {
        stream.getTracks().forEach(t => t.stop());
        setCameraStream(null);
        setIsVerifying(false);
        if (!session && !isMockMode) {
            alert("Please Sign In to continue.");
            setActiveView('login');
        } else {
            setActiveView(targetView);
        }
      }, 3000);
    } catch (e) {
      setTimeout(() => {
        setIsVerifying(false);
        if (!session && !isMockMode) {
             alert("Please Sign In to continue.");
             setActiveView('login');
        } else {
             setActiveView(targetView);
        }
      }, 2000);
    }
  };

  const renderRoadmap = (status: ApplicationStatus) => {
    const steps: { key: ApplicationStatus; label: string }[] = [
      { key: 'pending', label: 'Review' },
      { key: 'interview_set', label: 'Interview' },
      { key: 'passed', label: 'Hired' }
    ];
    const isStageFailed = status.startsWith('failed');
    return (
      <div className="mt-4">
        <div className="flex items-center justify-between relative px-4">
          <div className="absolute top-3 left-8 right-8 h-0.5 bg-slate-200 z-0" />
          {steps.map((step, idx) => {
            const isCompleted = status === 'passed' || (status === 'interview_set' && idx <= 1) || (status === 'pending' && idx === 0);
            const failedAtThisStage = (status === 'failed_shortlist' && idx === 0) || (status === 'failed_interview' && idx === 1);
            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${failedAtThisStage ? 'bg-red-500 text-white' : isCompleted ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border-2 border-slate-200 text-slate-300'}`}>
                  {failedAtThisStage ? <X size={14} /> : step.key === 'passed' && status === 'passed' ? <Trophy size={14} /> : (isCompleted ? <CheckCircle size={14} /> : idx + 1)}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-tighter ${failedAtThisStage ? 'text-red-500' : isCompleted ? 'text-blue-600' : 'text-slate-400'}`}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderView = () => {
    if (!session && activeView === 'role_selection') {
      return (
        <div className="min-h-screen bg-white p-8 flex flex-col justify-center items-center text-center">
          {isMockMode && (
            <div className="absolute top-4 left-4 right-4 bg-orange-100 text-orange-700 p-3 rounded-xl text-xs font-bold border border-orange-200 flex items-center gap-2">
              <Database size={14}/> Demo Mode: Data will not be saved. Connect Supabase to fix.
            </div>
          )}
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-xl shadow-blue-100"><Briefcase size={32} /></div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Welcome to Work</h1>
          <p className="text-slate-500 font-medium mb-12">Select your role to begin.</p>
          <div className="grid grid-cols-1 gap-4 w-full">
            <button onClick={() => { setUserRole('candidate'); setActiveView('onboarding'); }} className="p-6 rounded-3xl border-2 border-slate-100 hover:border-blue-600 hover:bg-blue-50 transition-all flex flex-col items-center gap-3 group">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all"><UserIcon size={28} /></div>
              <div><h3 className="font-bold text-slate-800">I'm a Job Seeker</h3><p className="text-[10px] text-slate-400">Discover roles and apply securely.</p></div>
            </button>
            <button onClick={() => { setUserRole('employer'); setActiveView('onboarding'); }} className="p-6 rounded-3xl border-2 border-slate-100 hover:border-blue-600 hover:bg-blue-50 transition-all flex flex-col items-center gap-3 group">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all"><Briefcase size={28} /></div>
              <div><h3 className="font-bold text-slate-800">I'm Hiring</h3><p className="text-[10px] text-slate-400">Manage candidates and hiring funnel.</p></div>
            </button>
          </div>
          <button onClick={() => setActiveView('login')} className="mt-8 text-blue-600 font-bold text-sm">
            Already have an account? <span className="underline">Sign In</span>
          </button>
        </div>
      );
    }

    switch (activeView) {
      case 'login':
        return (
          <div className="min-h-screen bg-white p-8 flex flex-col">
            <header className="mb-4 -ml-4"><button onClick={() => setActiveView('role_selection')} className="p-2 text-slate-400 hover:text-blue-600"><ChevronLeft size={28} /></button></header>
            <div className="flex-1 flex flex-col justify-center">
              <h1 className="text-4xl font-black text-slate-900 mb-2">Welcome Back</h1>
              <p className="text-slate-500 font-medium mb-12">Sign in to continue.</p>
              <div className="space-y-4">
                <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="email" placeholder="Email Address" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={userData.email} onChange={(e) => setUserData({...userData, email: e.target.value})} /></div>
                <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="password" placeholder="Password" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={userData.password} onChange={(e) => setUserData({...userData, password: e.target.value})} /></div>
              </div>
            </div>
            <div className="mt-auto pt-8">
              <button onClick={handleLogin} disabled={authLoading} className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-bold shadow-xl flex items-center justify-center gap-2">
                {authLoading ? <Loader2 className="animate-spin"/> : 'Sign In'}
              </button>
              <button onClick={() => setActiveView('role_selection')} className="w-full text-center mt-4 text-slate-400 text-xs font-bold">
                Don't have an account? <span className="text-blue-600">Sign Up</span>
              </button>
            </div>
          </div>
        );

      case 'onboarding':
        return (
          <div className="min-h-screen bg-white p-8 flex flex-col">
            <header className="mb-4 -ml-4"><button onClick={() => setActiveView('role_selection')} className="p-2 text-slate-400 hover:text-blue-600"><ChevronLeft size={28} /></button></header>
            <div className="flex-1 flex flex-col justify-center">
              <h1 className="text-4xl font-black text-slate-900 mb-2">Create {userRole} Account</h1>
              <p className="text-slate-500 font-medium mb-12">Enter your professional details.</p>
              <div className="space-y-4">
                {userRole === 'employer' && <div className="relative"><Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Company Name" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={userData.company} onChange={(e) => setUserData({...userData, company: e.target.value})} /></div>}
                <div className="relative"><UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Full Name" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={userData.username} onChange={(e) => setUserData({...userData, username: e.target.value})} /></div>
                <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="email" placeholder="Email Address" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={userData.email} onChange={(e) => setUserData({...userData, email: e.target.value})} /></div>
                <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="password" placeholder="Password" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={userData.password} onChange={(e) => setUserData({...userData, password: e.target.value})} /></div>
              </div>
            </div>
            <div className="mt-auto pt-8">
              <button onClick={handleOnboardingSubmit} disabled={authLoading} className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-bold shadow-xl flex items-center justify-center gap-2">
                {authLoading ? <Loader2 className="animate-spin"/> : 'Sign Up'}
              </button>
              <button onClick={() => setActiveView('login')} className="w-full text-center mt-4 text-slate-400 text-xs font-bold">
                Already have an account? <span className="text-blue-600">Sign In</span>
              </button>
            </div>
          </div>
        );

      case 'face_setup':
        return (
          <div className="min-h-screen bg-white p-8 flex flex-col items-center">
            <header className="w-full mb-8 -ml-4 flex justify-start"><button onClick={() => setActiveView('onboarding')} className="p-2 text-slate-400 hover:text-blue-600"><ChevronLeft size={28} /></button></header>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6"><ScanFace size={40} /></div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">Face Identity</h2>
              <p className="text-slate-500 font-medium mb-12">Verify ownership for secure applications.</p>
              <div className="w-full max-w-[280px] aspect-square bg-slate-50 rounded-[60px] border-2 border-dashed border-blue-200 flex items-center justify-center overflow-hidden"><Camera size={48} className="text-blue-200" /></div>
            </div>
            <button onClick={() => startIdentityVerification(userRole === 'employer' ? 'employer_dashboard' : 'feed')} className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-bold shadow-xl">Start Verification</button>
          </div>
        );

      case 'employer_dashboard':
        const myJobs = jobs.filter(j => j.employerId === session?.user?.id);
        
        return (
          <div className="pb-24">
            <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-20 shadow-sm flex justify-between items-center">
               <div><h1 className="text-2xl font-black text-slate-900">Employer Dashboard</h1><p className="text-xs text-slate-400 uppercase font-black">Control hiring flow</p></div>
               <button onClick={() => setActiveView('post_job')} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg hover:bg-blue-700 transition-colors"><PlusCircle size={24}/></button>
            </header>
            <main className="px-6 mt-6 space-y-4">
              {myJobs.map(job => {
                const jobApps = applications.filter(a => a.jobId === job.id);
                const pendingCount = jobApps.filter(a => a.status === 'pending').length;
                return (
                  <div key={job.id} onClick={() => { setSelectedJob(job); setActiveView('view_applicants'); }} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm cursor-pointer hover:shadow-md transition-all relative">
                    <button onClick={(e) => handleDeleteJob(job.id, e)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all z-10"><Trash2 size={18}/></button>
                    <div className="flex justify-between items-start mb-4 pr-10">
                      <div className="flex-1"><h3 className="text-lg font-bold text-slate-800">{job.title}</h3><p className="text-[10px] text-slate-400 uppercase font-bold">{job.type} • {job.workplace}</p></div>
                      <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1"><Users size={14}/> {jobApps.length}</div>
                    </div>
                    {pendingCount > 0 && <div className="text-[10px] font-black text-orange-500 flex items-center gap-1 uppercase"><Bell size={12}/> {pendingCount} new applicants</div>}
                  </div>
                );
              })}
              {myJobs.length === 0 && <div className="text-center py-10 text-slate-400">No active jobs found. Post one now!</div>}
            </main>
          </div>
        );

      case 'post_job':
        return (
          <div className="min-h-screen bg-white pb-32">
             <header className="px-6 pt-6 pb-4 flex items-center gap-4 bg-white sticky top-0 z-20 shadow-sm">
               <button onClick={() => setActiveView('employer_dashboard')} className="p-2 text-slate-400 hover:text-slate-600"><ChevronLeft size={24}/></button>
               <h1 className="text-lg font-bold text-slate-900">Create New Job</h1>
             </header>
             <div className="px-6 mt-6 space-y-6">
                
                {/* Basic Info Card */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><Briefcase size={16} className="text-blue-500"/> Core Details</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Job Title</label>
                      <input type="text" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-800 focus:outline-blue-500" placeholder="e.g. Senior Product Designer" value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Type</label>
                        <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-800 focus:outline-blue-500 appearance-none" value={newJob.type} onChange={e => setNewJob({...newJob, type: e.target.value as JobType})}>
                           <option>Full-time</option><option>Part-time</option><option>Freelance</option><option>Student-friendly</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Sector</label>
                        <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-800 focus:outline-blue-500 appearance-none" value={newJob.sector} onChange={e => setNewJob({...newJob, sector: e.target.value})}>
                           {SECTORS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Location</label>
                      <input type="text" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-800 focus:outline-blue-500" placeholder="e.g. BKK1, Phnom Penh" value={newJob.workplace} onChange={e => setNewJob({...newJob, workplace: e.target.value})} />
                    </div>
                  </div>
                </div>

                {/* Logistics Card */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                   <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><Clock size={16} className="text-blue-500"/> Logistics</h3>
                   <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Salary Range</label>
                            <input type="text" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-800 focus:outline-blue-500" placeholder="$500 - $1000" value={newJob.salary} onChange={e => setNewJob({...newJob, salary: e.target.value})} />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Hours</label>
                            <input type="text" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-800 focus:outline-blue-500" placeholder="8am - 5pm" value={newJob.workingHours} onChange={e => setNewJob({...newJob, workingHours: e.target.value})} />
                         </div>
                      </div>
                      
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Closing Date</label>
                         <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input type="date" className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-800 focus:outline-blue-500" value={newJob.endDate} onChange={e => setNewJob({...newJob, endDate: e.target.value})} />
                         </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Contact Phone</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input type="tel" className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-800 focus:outline-blue-500" placeholder="+855 12 345 678" value={newJob.contactPhone} onChange={e => setNewJob({...newJob, contactPhone: e.target.value})} />
                        </div>
                      </div>
                   </div>
                </div>

                {/* Description Card */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><TextQuote size={16} className="text-blue-500"/> Role Description</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Overview</label>
                      <textarea rows={4} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium text-slate-800 focus:outline-blue-500 text-sm" placeholder="Briefly describe the opportunity..." value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Key Responsibilities</label>
                      <textarea rows={4} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium text-slate-800 focus:outline-blue-500 text-sm" placeholder="• Do this&#10;• Do that" value={newJob.roleDetails} onChange={e => setNewJob({...newJob, roleDetails: e.target.value})} />
                    </div>
                  </div>
                </div>

                {/* Requirements Card */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                   <div className="flex justify-between items-center">
                     <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><ListPlus size={16} className="text-blue-500"/> Requirements</h3>
                     <button onClick={handleAddRequirement} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 hover:bg-blue-100"><PlusCircle size={14}/> Add Item</button>
                   </div>
                   
                   <div className="space-y-3">
                     {newJob.requirements.map((req, idx) => (
                       <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative group transition-all hover:border-blue-200">
                         <div className="space-y-2 mr-6">
                           <input type="text" className="w-full bg-white p-2 rounded-lg text-xs font-bold border border-slate-200 focus:border-blue-400 outline-none" placeholder="Document Name (e.g. CV)" value={req.name} onChange={(e) => handleUpdateRequirement(idx, 'name', e.target.value)} />
                           <input type="text" className="w-full bg-white p-2 rounded-lg text-xs border border-slate-200 focus:border-blue-400 outline-none" placeholder="Reason (e.g. To verify background)" value={req.why} onChange={(e) => handleUpdateRequirement(idx, 'why', e.target.value)} />
                         </div>
                         <button onClick={() => handleRemoveRequirement(idx)} className="text-slate-300 absolute top-3 right-3 hover:text-red-500 transition-colors"><MinusCircle size={20}/></button>
                       </div>
                     ))}
                   </div>
                   <div className="flex items-start gap-2 text-xs text-slate-400 mt-2 bg-slate-50 p-3 rounded-xl">
                      <Info size={16} className="mt-0.5 shrink-0"/>
                      <p>These requirements will appear as upload fields for candidates. We automatically hash documents for security.</p>
                   </div>
                </div>

                <div className="h-4"></div> {/* Spacer */}
                
                <button onClick={handlePostJob} disabled={!newJob.title || isSubmittingJob} className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-bold shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all text-lg">
                  {isSubmittingJob ? <Loader2 className="animate-spin"/> : 'Publish Job Listing'}
                </button>
             </div>
          </div>
        );

      case 'view_applicants':
        if (!selectedJob) return null;
        const relevantApps = applications.filter(a => a.jobId === selectedJob.id);
        return (
          <div className="min-h-screen bg-slate-50 pb-24 relative">
            {viewingDoc && (
              <div className="fixed inset-0 z-[60] bg-slate-900/95 backdrop-blur-sm flex flex-col items-center p-6">
                <div className="w-full max-w-lg h-full bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
                  <header className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div><h3 className="text-sm font-bold">{viewingDoc.docName}</h3><p className="text-[10px] text-slate-400">{viewingDoc.fileName}</p></div>
                    <button onClick={() => setViewingDoc(null)} className="p-2 bg-white rounded-full"><X size={20}/></button>
                  </header>
                  <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-4"><FileText size={40}/></div>
                    <p className="text-xs font-bold">Secure PDF Inspection</p>
                    <p className="text-[10px] text-slate-400 mt-2">Document is stored securely in Supabase Storage.</p>
                    <button onClick={async () => {
                      const { data } = await supabase.storage.from('documents').createSignedUrl(viewingDoc.fileName, 60);
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                    }} className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                      <ExternalLink size={14}/> Open Signed PDF
                    </button>
                  </div>
                </div>
              </div>
            )}
            <header className="px-6 pt-8 pb-4 bg-white shadow-sm flex items-center gap-4">
               <button onClick={() => setActiveView('employer_dashboard')} className="p-2 text-slate-400"><ChevronLeft/></button>
               <div><h1 className="text-lg font-bold text-slate-900">{selectedJob.title}</h1><p className="text-[10px] text-slate-400 uppercase font-black">Application Pool</p></div>
            </header>
            <main className="px-6 mt-6 space-y-4">
              {relevantApps.map(app => (
                <div key={app.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-600 font-black text-lg">{app.candidateName?.charAt(0) || 'U'}</div>
                    <div className="flex-1"><h4 className="font-bold text-slate-800">{app.candidateName || 'Unknown Candidate'}</h4><p className="text-[10px] text-slate-400 uppercase font-black">{app.status.replace('_', ' ')}</p></div>
                    <button className="p-2 text-blue-600 bg-blue-50 rounded-xl" onClick={() => setActiveView('chat')}><MessageCircle size={20}/></button>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                     <p className="text-[9px] font-black text-slate-400 uppercase">Documents</p>
                     {Object.entries(app.uploadedDocs || {}).map(([name, fileName]) => (
                       <div key={name} className="flex items-center justify-between text-xs font-bold bg-white p-2 rounded-xl border border-slate-50">
                         <span className="flex items-center gap-2"><FileText size={14} className="text-blue-500"/>{name}</span>
                         <button onClick={() => setViewingDoc({ app, docName: name, fileName: fileName as string })} className="text-blue-600 p-1.5 hover:bg-blue-50 rounded-lg flex items-center gap-1.5"><Eye size={14}/><span className="text-[9px] font-black uppercase">Inspect</span></button>
                       </div>
                     ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {app.status === 'pending' && (
                      <>
                        <button onClick={() => updateApplicationStatus(app.id, 'interview_set')} className="bg-blue-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase">Shortlist</button>
                        <button onClick={() => updateApplicationStatus(app.id, 'failed_shortlist')} className="bg-red-50 text-red-600 py-3 rounded-2xl text-[10px] font-black uppercase">Reject</button>
                      </>
                    )}
                    {app.status === 'interview_set' && (
                      <>
                        <button onClick={() => updateApplicationStatus(app.id, 'passed')} className="bg-green-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase">Hired</button>
                        <button onClick={() => updateApplicationStatus(app.id, 'failed_interview')} className="bg-red-50 text-red-600 py-3 rounded-2xl text-[10px] font-black uppercase">Fail</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {relevantApps.length === 0 && <div className="text-center text-slate-400 py-4">No applicants yet.</div>}
            </main>
          </div>
        );

      case 'feed':
        return (
          <div className="pb-24">
            <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-20 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-extrabold text-blue-600">Work</h1>
                <div className="flex gap-4">
                  <div className="relative"><Bell className="text-slate-400"/><div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"/></div>
                  <UserIcon className="text-slate-400" />
                </div>
              </div>
              <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Search roles..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {(['All', 'Full-time', 'Part-time', 'Freelance'] as const).map(type => (
                  <button key={type} onClick={() => setFilterType(type)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterType === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{type}</button>
                ))}
              </div>
            </header>
            <main className="px-6 mt-6">
              {jobs.filter(j => filterType === 'All' || j.type === filterType).map(job => (
                <div key={job.id} onClick={() => { setSelectedJob(job); setActiveView('job_details'); }} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mb-4 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1"><span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 mb-2 inline-block">{job.type}</span><h3 className="text-lg font-bold text-slate-800">{job.title}</h3><p className="text-slate-400 font-semibold text-xs">{job.company}</p></div>
                    <button className={`p-2 rounded-xl text-slate-300`}><Bookmark /></button>
                  </div>
                  <div className="flex gap-4 text-[10px] font-bold text-slate-400 mt-4"><div className="flex items-center gap-1"><MapPin size={14}/>{job.workplace}</div><div className="flex items-center gap-1"><Clock size={14}/>{job.salary}</div></div>
                </div>
              ))}
              {jobs.length === 0 && <div className="text-center py-10 text-slate-400">Loading jobs or no jobs found...</div>}
            </main>
          </div>
        );

      case 'job_details':
        if (!selectedJob) return null;
        return (
          <div className="min-h-screen bg-white pb-32">
            <header className="px-6 pt-6 pb-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur z-20"><button onClick={() => setActiveView('feed')} className="p-2 text-slate-600 bg-slate-50 rounded-full"><ChevronLeft /></button><h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Position</h2><button className="p-2 text-slate-300"><Bookmark /></button></header>
            <div className="px-6 mt-4">
              <div className="bg-blue-600 rounded-[40px] p-8 text-white shadow-xl mb-8">
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full mb-4 inline-block">{selectedJob.type}</span>
                <h1 className="text-3xl font-extrabold">{selectedJob.title}</h1>
                <p className="text-blue-100 mt-2 font-medium">{selectedJob.company}</p>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="bg-white/10 px-4 py-3 rounded-2xl text-[10px] font-bold">Hours: {selectedJob.workingHours}</div>
                  <div className="bg-white/10 px-4 py-3 rounded-2xl text-[10px] font-bold">Salary: {selectedJob.salary}</div>
                </div>
              </div>
              <div className="space-y-8">
                <section><h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><TextQuote size={20} className="text-blue-600"/>About</h3><p className="text-sm text-slate-600 leading-relaxed">{selectedJob.description}</p></section>
                <section><h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Target size={20} className="text-blue-600"/>Role</h3><p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{selectedJob.roleDetails}</p></section>
                <button onClick={() => { setApplicationDraft({}); setActiveView('apply'); }} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-bold flex items-center justify-center gap-3 shadow-xl text-lg">Apply Now <ArrowRight size={22} /></button>
              </div>
            </div>
          </div>
        );

      case 'apply':
        if (!selectedJob) return null;
        return (
          <div className="min-h-screen bg-slate-50 pb-32">
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileUpload} />
            <header className="bg-white px-6 pt-6 pb-4 flex items-center justify-between shadow-sm sticky top-0"><button onClick={() => setActiveView('job_details')} className="p-2 text-slate-600"><ChevronLeft /></button><h2 className="text-sm font-bold">Submit Application</h2><div className="w-10"/></header>
            <div className="px-6 mt-8 space-y-6">
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Upload PDF Files</h3>
                <div className="space-y-4">
                  {(selectedJob.requirements || []).map(req => {
                    const doc = applicationDraft[req.name];
                    return (
                      <div key={req.name} className={`p-4 rounded-[24px] border flex items-center justify-between transition-all ${doc ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${doc ? 'bg-blue-600 text-white' : 'bg-white text-slate-300 shadow-sm'}`}>{doc ? <FileCheck size={20} /> : <Upload size={20} />}</div>
                          <div className="flex flex-col"><p className="text-sm font-bold text-slate-700">{req.name}</p></div>
                        </div>
                        {doc ? <button onClick={() => removeFile(req.name)} className="text-red-500 p-2"><X size={20} /></button> : <button onClick={() => triggerUpload(req.name)} className="text-blue-600 bg-white px-4 py-2 rounded-xl text-[10px] font-black border border-blue-100 uppercase">Upload</button>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <button disabled={Object.keys(applicationDraft).length === 0} onClick={() => startIdentityVerification('ready_to_submit')} className="w-full py-5 rounded-[24px] font-extrabold flex items-center justify-center gap-3 bg-blue-600 text-white shadow-xl"><ScanFace size={22} /> Verify & Submit</button>
            </div>
          </div>
        );

      case 'tracking':
        const userApps = applications.filter(a => a.candidateId === session?.user.id);
        return (
          <div className="pb-24">
            <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-20 shadow-sm"><h1 className="text-2xl font-extrabold text-slate-900">Tracking</h1></header>
            <main className="px-6 mt-6 space-y-4">
              {userApps.map(app => {
                const isFail = app.status.startsWith('failed');
                const job = jobs.find(j => j.id === app.jobId);
                const title = job?.title || 'Application';
                const company = job?.company || 'Unknown Company';
                
                return (
                  <div key={app.id} className={`bg-white p-6 rounded-[32px] border shadow-sm ${isFail ? 'border-red-100 opacity-80' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div><h4 className="font-bold text-slate-800 text-lg">{title}</h4><p className="text-[10px] text-slate-400 uppercase font-black">{company} • Submitted: {new Date(app.submittedAt).toLocaleDateString()}</p></div>
                      {app.status === 'passed' && <Trophy className="text-green-500" size={24}/>}
                      {isFail && <AlertCircle className="text-red-500" size={24}/>}
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">{renderRoadmap(app.status)}</div>
                  </div>
                );
              })}
              {userApps.length === 0 && <div className="text-center py-10 text-slate-400">No active applications.</div>}
            </main>
          </div>
        );

      case 'verifying':
        return (
          <div className="h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
            <div className="relative w-64 h-64 mb-10"><div className="absolute inset-0 border-4 border-blue-600 rounded-[56px] overflow-hidden bg-slate-100 shadow-2xl"><video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" /><div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500 shadow-[0_0_20px_#3b82f6] animate-[scan_4s_infinite]" /></div></div>
            <h2 className="text-2xl font-black text-slate-900 mb-3">Authenticating...</h2>
            <p className="text-slate-500 font-medium">Hashing biometrics for secure submission.</p>
          </div>
        );

      case 'ready_to_submit':
        return (
          <div className="h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
            <div className="w-28 h-28 bg-green-50 text-green-600 rounded-[40px] flex items-center justify-center mb-8 animate-pulse shadow-sm"><CheckCircle size={56} /></div>
            <h1 className="text-3xl font-black text-slate-900 mb-3">Identity Match!</h1>
            <p className="text-slate-500 font-medium mb-12">Confirm your application submission.</p>
            <button onClick={finalizeSubmission} className="w-full bg-blue-600 text-white py-5 rounded-[28px] font-black shadow-2xl hover:bg-blue-700 transition-all text-lg">{isVerifying ? <Loader2 className="animate-spin inline"/> : 'Finalize Application'}</button>
          </div>
        );

      case 'profile':
        return (
          <div className="pb-24">
            <header className="px-6 pt-8 pb-12 bg-blue-600 text-white rounded-b-[48px] shadow-xl">
              <div className="flex justify-between items-center mb-8"><h1 className="text-2xl font-extrabold">Profile</h1><ShieldCheck className="text-blue-200" /></div>
              <div className="flex items-center gap-6"><div className="w-20 h-20 rounded-3xl border-4 border-white/20 bg-white/10 flex items-center justify-center text-4xl">👤</div><div><h2 className="text-xl font-bold">{profile?.full_name || userData.username || 'Guest'}</h2><p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest mt-1">Verified {profile?.role || userRole}</p></div></div>
            </header>
            <main className="px-6 -mt-6">
              <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-50">
                <div className="space-y-6">
                  <div><p className="text-[10px] text-slate-400 font-black uppercase">Email</p><p className="text-sm font-bold text-slate-800">{session?.user.email}</p></div>
                  {profile?.role === 'employer' && <div><p className="text-[10px] text-slate-400 font-black uppercase">Company</p><p className="text-sm font-bold text-slate-800">{profile?.company_name}</p></div>}
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-400">Secure Identity</span><div className="w-3 h-3 bg-green-500 rounded-full shadow-lg shadow-green-200"/></div>
                </div>
              </div>
              <button onClick={async () => { await supabase.auth.signOut(); setActiveView('role_selection'); setSession(null); setProfile(null); }} className="w-full text-red-500 font-black text-xs uppercase tracking-widest py-10 mt-4">Sign Out</button>
            </main>
          </div>
        );

      default:
        return <div>View Loading...</div>;
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 relative overflow-x-hidden shadow-2xl border-x border-slate-100">
      {renderView()}
      {session && !['verifying', 'ready_to_submit', 'face_setup', 'login', 'onboarding', 'role_selection'].includes(activeView as string) && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-lg border-t border-slate-100 flex justify-around items-center py-5 z-40 px-4 rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <button onClick={() => setActiveView(userRole === 'employer' ? 'employer_dashboard' : 'feed')} className={`flex flex-col items-center gap-1 ${activeView === 'feed' || activeView === 'employer_dashboard' ? 'text-blue-600' : 'text-slate-400'}`}>
            <Home size={22} /><span className="text-[9px] font-black uppercase">Home</span>
          </button>
          <button onClick={() => setActiveView(userRole === 'employer' ? 'employer_dashboard' : 'tracking')} className={`flex flex-col items-center gap-1 ${activeView === 'tracking' ? 'text-blue-600' : 'text-slate-400'}`}>
            <ClipboardList size={22} /><span className="text-[9px] font-black uppercase">Track</span>
          </button>
          <button onClick={() => setActiveView('profile')} className={`flex flex-col items-center gap-1 ${activeView === 'profile' ? 'text-blue-600' : 'text-slate-400'}`}>
            <UserIcon size={22} /><span className="text-[9px] font-black uppercase">Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
};

export default App;