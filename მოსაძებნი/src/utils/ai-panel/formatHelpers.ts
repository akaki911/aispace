
export const formatTimestamp = (timestamp: string | number | Date): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) { // Less than 1 minute
    return 'ახლახანს';
  } else if (diff < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diff / 60000);
    return `${minutes} წუთის წინ`;
  } else if (diff < 86400000) { // Less than 1 day
    const hours = Math.floor(diff / 3600000);
    return `${hours} საათის წინ`;
  } else {
    return date.toLocaleDateString('ka-GE');
  }
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}წმ`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}წთ ${remainingSeconds}წმ`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return `${hours}ს ${remainingMinutes}წთ`;
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const formatPercentage = (value: number, total: number): string => {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
};

export const formatUptime = (startTime: string | number | Date): string => {
  const start = new Date(startTime);
  const now = new Date();
  const uptimeMs = now.getTime() - start.getTime();
  
  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}დ ${hours}ს`;
  } else if (hours > 0) {
    return `${hours}ს ${minutes}წთ`;
  } else {
    return `${minutes}წთ`;
  }
};

export const formatMemoryUsage = (bytes: number): string => {
  return formatFileSize(bytes);
};

export const formatCpuUsage = (percentage: number): string => {
  return `${percentage.toFixed(1)}%`;
};

export const formatApiResponse = (status: number): string => {
  if (status >= 200 && status < 300) {
    return 'წარმატება';
  } else if (status >= 400 && status < 500) {
    return 'კლიენტის შეცდომა';
  } else if (status >= 500) {
    return 'სერვერის შეცდომა';
  } else {
    return 'უცნობი სტატუსი';
  }
};

export const formatLogLevel = (level: string): string => {
  switch (level.toUpperCase()) {
    case 'ERROR':
      return 'შეცდომა';
    case 'WARN':
    case 'WARNING':
      return 'გაფრთხილება';
    case 'INFO':
      return 'ინფორმაცია';
    case 'DEBUG':
      return 'დებაგი';
    default:
      return level;
  }
};
