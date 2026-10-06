import { EmptyState } from '../components/ui';
export default function Placeholder({ title, stage }: { title: string; stage: string }) {
  return (<div><h1 className="mb-4 text-xl font-semibold">{title}</h1>
    <EmptyState title="Not built yet" body={`Planned for ${stage}. Navigation is in place so the structure is final.`} /></div>);
}
