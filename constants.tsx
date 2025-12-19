
import { Job } from './types';

export const SECTORS = [
  'Technology', 'Hospitality', 'Education', 'Banking', 'Marketing', 'Real Estate', 'Design', 'Customer Service'
];

export const MOCK_JOBS: Job[] = [
  {
    id: '1',
    employerId: 'emp_001',
    title: 'Junior Web Developer',
    company: 'Khmer Digital Solutions',
    workplace: 'Tuol Kork, Phnom Penh',
    type: 'Full-time',
    sector: 'Technology',
    salary: '$500 - $800',
    workingHours: '8:30 AM - 5:30 PM (Mon-Fri)',
    requirements: [
      { name: 'CV / Resume', why: 'To evaluate your professional background.', instruction: 'Must be in PDF format and include at least two professional references.' },
      { name: 'Degree Transcript', why: 'To verify your education.', instruction: 'Scanned original copy in English or Khmer. Verified by university stamp preferred.' },
      { name: 'Portfolio Link', why: 'To see actual examples of coding.', instruction: 'Ensure your GitHub profile or personal website link is publicly accessible.' }
    ],
    description: 'Join our dynamic team building next-gen web apps for the Cambodian market.',
    roleDetails: '• Develop and maintain responsive user interfaces.\n• Integrate frontend components with RESTful APIs.\n• Participate in daily agile stand-ups.',
    postedAt: '2024-05-20',
    endDate: '2024-06-15',
    contactEmail: 'hr@khmerdigital.com',
    contactPhone: '+855 23 456 789'
  },
  {
    id: '2',
    employerId: 'emp_002',
    title: 'Part-time Barista',
    company: 'Brown Coffee',
    workplace: 'BKK1, Phnom Penh',
    type: 'Student-friendly',
    sector: 'Hospitality',
    salary: '$150 - $250',
    workingHours: 'Flexible: Morning (6AM-11AM) or Afternoon (1PM-6PM) shifts',
    requirements: [
      { name: 'Student ID', why: 'To confirm flexible shift eligibility.', instruction: 'A clear photo of your current valid university ID card.' },
      { name: 'Health Certificate', why: 'Required for food safety.', instruction: 'Must be issued within the last 6 months by a recognized clinic.' }
    ],
    description: 'Work at Cambodia’s leading coffee chain. Perfect for university students.',
    roleDetails: '• Prepare coffee beverages following brand recipes.\n• Operate espresso machines.\n• Provide friendly customer service.',
    postedAt: '2024-05-21',
    endDate: '2024-06-05',
    contactEmail: 'careers@browncoffee.com',
    contactPhone: '+855 12 345 678'
  },
  {
    id: '3',
    employerId: 'emp_001',
    title: 'UI/UX Designer',
    company: 'Khmer Digital Solutions',
    workplace: 'Daun Penh, Phnom Penh',
    type: 'Full-time',
    sector: 'Design',
    salary: '$700 - $1200',
    workingHours: '9:00 AM - 6:00 PM',
    requirements: [
      { name: 'Portfolio PDF', why: 'To review design aesthetics.', instruction: 'Must show mobile app case studies.' },
      { name: 'Design Challenge', why: 'To test problem solving skills.', instruction: 'We will send this after the initial CV screening.' }
    ],
    description: 'Create beautiful and functional interfaces for our suite of fintech products.',
    roleDetails: '• Design user flows and wireframes.\n• Create high-fidelity prototypes.\n• Conduct usability testing.',
    postedAt: '2024-05-22',
    endDate: '2024-06-20',
    contactEmail: 'design@khmerdigital.com',
    contactPhone: '+855 23 999 000'
  },
  {
    id: '4',
    employerId: 'emp_003',
    title: 'English Language Teacher',
    company: 'Phnom Penh International School',
    workplace: 'Sen Sok, Phnom Penh',
    type: 'Full-time',
    sector: 'Education',
    salary: '$1500 - $2200',
    workingHours: '7:30 AM - 4:30 PM',
    requirements: [
      { name: 'TEFL/CELTA Certificate', why: 'Legal requirement for teaching.', instruction: 'Certified copy from an accredited institution.' },
      { name: 'Background Check', why: 'Child protection policy.', instruction: 'Must be a clear criminal record from home country or local police.' }
    ],
    description: 'Join our prestigious international faculty and inspire the next generation.',
    roleDetails: '• Plan and deliver engaging English lessons.\n• Assess student progress and provide feedback.\n• Attend faculty meetings and school events.',
    postedAt: '2024-05-23',
    endDate: '2024-06-30',
    contactEmail: 'hr@ppis.edu.kh',
    contactPhone: '+855 11 222 333'
  },
  {
    id: '5',
    employerId: 'emp_004',
    title: 'Bank Teller',
    company: 'ABA Bank',
    workplace: 'Koh Pich, Phnom Penh',
    type: 'Full-time',
    sector: 'Banking',
    salary: '$350 - $550',
    workingHours: '8:00 AM - 4:00 PM',
    requirements: [
      { name: 'Integrity Declaration', why: 'Trust is paramount in banking.', instruction: 'Signed form declaring no financial conflicts.' },
      { name: 'Bachelor Degree', why: 'Fundamental knowledge required.', instruction: 'Banking or Finance related field preferred.' }
    ],
    description: 'Be the face of Cambodia’s most innovative bank.',
    roleDetails: '• Process cash transactions accurately.\n• Promote bank products to customers.\n• Maintain high standards of customer service.',
    postedAt: '2024-05-24',
    endDate: '2024-06-10',
    contactEmail: 'recruitment@ababank.com',
    contactPhone: '+855 98 777 666'
  },
  {
    id: '6',
    employerId: 'emp_005',
    title: 'Social Media Manager',
    company: 'Social Ace Agency',
    workplace: 'BKK2, Phnom Penh',
    type: 'Freelance',
    sector: 'Marketing',
    salary: '$30 - $50 / Day',
    workingHours: 'Flexible / Project Based',
    requirements: [
      { name: 'Content Plan Example', why: 'To see your strategic thinking.', instruction: 'A 1-week sample plan for a retail brand.' },
      { name: 'References', why: 'To verify project reliability.', instruction: 'Contact details of two previous clients.' }
    ],
    description: 'Manage high-growth social accounts for local SMEs.',
    roleDetails: '• Design daily social media posts.\n• Manage community engagement and comments.\n• Analyze campaign performance metrics.',
    postedAt: '2024-05-25',
    endDate: '2024-07-01',
    contactEmail: 'hello@socialace.com',
    contactPhone: '+855 16 555 444'
  }
];

export const MOCK_USER = {
  id: 'user_123',
  name: 'Sovanmony Rath',
  role: 'candidate' as const,
  verified: true,
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sovanmony'
};

export const MOCK_EMPLOYER = {
  id: 'emp_001',
  name: 'Bona Chen',
  role: 'employer' as const,
  company: 'Khmer Digital Solutions',
  verified: true,
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bona'
};
