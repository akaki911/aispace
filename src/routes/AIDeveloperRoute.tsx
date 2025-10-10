import AIDeveloperPanel from '@aispace/components/AIDeveloperPanel';
import { useAuth } from '@/contexts/useAuth';
import { usePermissions } from '@/contexts/usePermissions';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContextObject';

const loadingFallback = (
  <div className="p-6 text-sm text-slate-500">AI სივრცე იტვირთება...</div>
);

const AIDeveloperRoute = () => {
  const { isAuthenticated, isLoading: authLoading, hasRole } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { isLoading: flagsLoading } = useFeatureFlagsContext();
  const isAiEnabled = useFeatureFlag('AI');

  if (authLoading || permissionsLoading || flagsLoading) {
    return loadingFallback;
  }

  const hasDeveloperAccess =
    isAuthenticated &&
    isAiEnabled &&
    (hasRole('SUPER_ADMIN') || hasRole('DEVELOPER') || hasPermission('ai_developer_access'));

  if (!hasDeveloperAccess) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <div className="max-w-xl space-y-4">
          <h1 className="text-2xl font-semibold text-slate-100">AI დეველოპერის პანელი</h1>
          <p className="text-sm leading-relaxed text-slate-300">
            ეს დემო ვერ უერთდება საწარმოს აუთენტიფიკაციას, ამიტომ "დეველოპერის" ხედისათვის
            არ ხორციელდება ავტომატური ავტორიზაცია. რეალურ გარემოში ამ ეკრანზე მხოლოდ შესაბამისი
            როლის მქონე მომხმარებლები მოხვდებიან.
          </p>
          <p className="text-xs leading-relaxed text-slate-500">
            ამ ინსტალაციაში შეგიძლიათ უბრალოდ დაათვალიეროთ ინტერფეისი — ავტორიზაციის გარეშე ფუნქციონალი
            მიუწვდომელია და სწორედ ამიტომ ცარიელი გვერდი ჩნდებოდა. ადმინისტრატორის სისტემასთან მიერთების
            გარეშე დამატებითი ნაბიჯების შესრულება საჭირო არ არის.
          </p>
        </div>
      </div>
    );
  }

  return <AIDeveloperPanel />;
};

export default AIDeveloperRoute;

