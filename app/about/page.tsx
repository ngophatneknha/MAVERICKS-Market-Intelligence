import type { Metadata } from 'next';
import ProjectIntroduction from '@/components/ProjectIntroduction';
import '../dashboard/commerce-theme.css';
import '../dashboard/project-overview.css';
import './introduction.css';
import './kinetic.css';

export const metadata: Metadata = {
  title: 'Market Intelligence cho thương hiệu | Mavericks',
  description: 'Từ tín hiệu đối thủ đến quyết định giá, lợi nhuận và vốn. Khám phá Mavericks — workspace giúp thương hiệu thương mại điện tử chủ động trong từng phương án kinh doanh.',
};

export default function IntroductionPage() {
  return <ProjectIntroduction/>;
}
