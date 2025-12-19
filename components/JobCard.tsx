
import React from 'react';
import { Job } from '../types';
import { MapPin, Calendar } from 'lucide-react';

interface JobCardProps {
  job: Job;
  onClick: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onClick }) => {
  return (
    <div 
      onClick={() => onClick(job)}
      className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-bold text-slate-800 leading-tight">{job.title}</h3>
          <p className="text-blue-600 font-semibold text-xs mt-0.5">{job.company}</p>
        </div>
        <span className="bg-blue-50 text-blue-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">
          {job.type}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-4 text-slate-500 text-[10px] font-medium mt-4">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} className="text-slate-400" />
          {job.workplace}
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-slate-400" />
          Ends: {job.endDate}
        </div>
      </div>
    </div>
  );
};
