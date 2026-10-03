import type { Metadata } from 'next';
import ProjectIntroduction from '@/components/ProjectIntroduction';
import '../dashboard/commerce-theme.css';
import '../dashboard/project-overview.css';
import './introduction.css';
import './kinetic.css';

export const metadata: Metadata = {
  title: 'Giới thiệu dự án | Mavericks',
  description: 'Mavericks kết nối biến động đối thủ với lợi nhuận và nhu cầu vốn của brand. Khám phá dự án và trải nghiệm demo Market Intelligence.',
};

export default function IntroductionPage() {
  return <ProjectIntroduction/>;
}
