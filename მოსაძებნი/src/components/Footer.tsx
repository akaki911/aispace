import type { FC } from 'react';

const Footer: FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-white border-t border-gray-200 py-4 text-center text-sm text-gray-500">
      © {year} Bakhmaro. ყველა უფლება დაცულია.
    </footer>
  );
};

export default Footer;
