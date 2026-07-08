import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Video, 
  Plus, 
  Search, 
  BarChart, 
  Award, 
  ThumbsUp, 
  MessageSquare, 
  ExternalLink, 
  TrendingUp, 
  X,
  Share2,
  Tv,
  CheckCircle2,
  Trophy
} from 'lucide-react';

const Contents = () => {
  const [contents, setContents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [streamers, setStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchName, setSearchName] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [sortBy, setSortBy] = useState('upload_date');

  // Modal log states
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedStreamerId, setSelectedStreamerId] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [title, setTitle] = useState('');
  const [uploadDate, setUploadDate] = useState('');
  const [link, setLink] = useState('');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [shares, setShares] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [modalError, setModalError] = useState('');

  // Handles state variables
  const [streamerAccounts, setStreamerAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Fetch handles/accounts whenever chosen streamer changes
  useEffect(() => {
    const fetchStreamerAccounts = async () => {
      if (!selectedStreamerId) return;
      try {
        const res = await api.get(`/accounts/streamers/${selectedStreamerId}/accounts`);
        setStreamerAccounts(res.data);
        if (res.data.length > 0) {
          setSelectedAccountId(res.data[0].id);
        } else {
          setSelectedAccountId('');
        }
      } catch (err) {
        console.error('Error fetching handles list for content manager:', err);
      }
    };
    fetchStreamerAccounts();
  }, [selectedStreamerId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (searchName) queryParams.append('streamerName', searchName);
      if (platformFilter) queryParams.append('platform', platformFilter);
      queryParams.append('sortBy', sortBy);

      const [contentRes, analyticsRes, streamersRes] = await Promise.all([
        api.get(`/content?${queryParams.toString()}`),
        api.get('/content/analytics'),
        api.get('/streamers')
      ]);

      setContents(contentRes.data);
      setAnalytics(analyticsRes.data);
      setStreamers(streamersRes.data);

      if (streamersRes.data.length > 0 && !selectedStreamerId) {
        setSelectedStreamerId(streamersRes.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching content library data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchData();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchName, platformFilter, sortBy]);

  const handleOpenModal = () => {
    setPlatform('TikTok');
    setTitle('');
    setUploadDate(new Date().toISOString().split('T')[0]);
    setLink('');
    setViews('');
    setLikes('');
    setComments('');
    setShares('');
    setModalSuccess('');
    setModalError('');
    setLogModalOpen(true);
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    setModalSuccess('');
    setModalError('');

    if (!selectedStreamerId || !title.trim() || !uploadDate) {
      setModalError('Please select a streamer, write a title, and provide the upload date.');
      return;
    }

    try {
      await api.post('/content', {
        streamer_id: selectedStreamerId,
        platform,
        title,
        upload_date: uploadDate,
        link,
        views: parseInt(views) || 0,
        likes: parseInt(likes) || 0,
        comments: parseInt(comments) || 0,
        shares: parseInt(shares) || 0,
        account_id: selectedAccountId || null
      });

      setModalSuccess('Content upload logged successfully!');
      
      // Reload lists and close modal after 1s
      fetchData();
      setTimeout(() => {
        setLogModalOpen(false);
      }, 1000);
    } catch (err) {
      console.error('Error logging content:', err);
      setModalError(err.response?.data?.message || 'Failed to save content upload.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Content Library & Analytics</h2>
          <p className="text-sm text-gray-400">Track views, likes, shares, and find the highest-performing content clips.</p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10 active:translate-y-px transition-all duration-200"
        >
          <Plus className="h-4.5 w-4.5" />
          Log Uploaded Content
        </button>
      </div>

      {/* Analytics Summary Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Top Video */}
          <div className="glass-panel p-5 rounded-2xl border bg-slate-950/20 space-y-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-400" />
              Top Performing Video
            </span>
            {analytics.topContent ? (
              <div>
                <strong className="block text-sm text-white truncate max-w-[280px]">
                  {analytics.topContent.title}
                </strong>
                <span className="text-xs text-indigo-400 block font-medium">
                  By {analytics.topContent.creator_name} &bull; {analytics.topContent.views.toLocaleString()} views
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-500 block">No content recorded yet.</span>
            )}
          </div>

          {/* Best Platform */}
          <div className="glass-panel p-5 rounded-2xl border bg-slate-950/20 space-y-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              Highest Virality Platform
            </span>
            {analytics.bestPlatform ? (
              <div>
                <strong className="block text-base text-white uppercase tracking-wider">
                  {analytics.bestPlatform.platform}
                </strong>
                <span className="text-xs text-cyan-400 block font-medium">
                  {parseInt(analytics.bestPlatform.total_views).toLocaleString()} views across {analytics.bestPlatform.post_count} posts
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-500 block">No platform views recorded.</span>
            )}
          </div>

          {/* Average Averages */}
          <div className="glass-panel p-5 rounded-2xl border bg-slate-950/20 space-y-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <BarChart className="h-4 w-4 text-emerald-400" />
              Averages Engagement KPIs
            </span>
            <div className="flex gap-4 text-xs font-semibold text-gray-300">
              <div>
                <span className="block text-[9px] text-gray-500 font-medium uppercase">Views</span>
                <strong className="text-white text-sm">{(analytics.averages.views || 0).toLocaleString()}</strong>
              </div>
              <div className="border-r border-dark-border h-6 self-center" />
              <div>
                <span className="block text-[9px] text-gray-500 font-medium uppercase">Likes</span>
                <strong className="text-white text-sm">{(analytics.averages.likes || 0).toLocaleString()}</strong>
              </div>
              <div className="border-r border-dark-border h-6 self-center" />
              <div>
                <span className="block text-[9px] text-gray-500 font-medium uppercase">Comments</span>
                <strong className="text-white text-sm">{(analytics.averages.comments || 0).toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Table Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main List Table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters card */}
          <div className="glass-panel p-4 rounded-2xl border bg-slate-950/15 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute inset-y-0 left-0 pl-3.5 h-full w-4.5 text-gray-500 flex items-center pointer-events-none" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search by creator name..."
                className="block w-full pl-10 pr-3 py-1.5 text-xs rounded-xl border border-dark-border bg-slate-900/60 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-3.5 py-1.5 text-xs rounded-xl border border-dark-border bg-slate-900/60 text-white cursor-pointer focus:outline-none"
            >
              <option value="">All Platforms</option>
              <option value="TikTok">TikTok</option>
              <option value="YouTube">YouTube</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3.5 py-1.5 text-xs rounded-xl border border-dark-border bg-slate-900/60 text-white cursor-pointer focus:outline-none"
            >
              <option value="upload_date">Sort: Newest</option>
              <option value="views">Sort: Views</option>
              <option value="likes">Sort: Likes</option>
              <option value="comments">Sort: Comments</option>
            </select>
          </div>

          {/* List Table */}
          <div className="glass-panel rounded-2xl border bg-slate-950/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-border bg-slate-950/50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="py-3 px-4">Content Details</th>
                    <th className="py-3 px-3">Platform</th>
                    <th className="py-3 px-3 text-right">Views</th>
                    <th className="py-3 px-3 text-right">Likes</th>
                    <th className="py-3 px-3 text-right">Comments</th>
                    <th className="py-3 px-4 text-center">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border/40 text-xs text-gray-300">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-indigo-400 font-semibold">Updating library...</td>
                    </tr>
                  ) : contents.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-500">No content matches found.</td>
                    </tr>
                  ) : (
                    contents.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-900/20 transition-colors">
                        <td className="py-3 px-4">
                          <strong className="text-white block font-medium truncate max-w-[220px]">{item.title}</strong>
                          <span className="text-[10px] text-gray-400">By {item.streamer_name} {item.account_username ? `(${item.account_username})` : ''} &bull; {item.upload_date.split('T')[0]}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full border border-dark-border bg-slate-900/50 text-[9px] uppercase font-bold text-indigo-400">
                            {item.platform}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">{(item.views).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-mono">{(item.likes).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-mono">{(item.comments).toLocaleString()}</td>
                        <td className="py-3 px-4 text-center">
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex p-1 rounded hover:bg-slate-900 text-indigo-400 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Top 10 Virality Rankings (Right Sidebar) */}
        <div className="glass-panel p-5 rounded-2xl border bg-slate-950/20 h-fit space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-dark-border pb-3 flex items-center gap-1.5">
            <Trophy className="h-4.5 w-4.5 text-amber-500" />
            Top 10 Content Leaderboard
          </h3>

          <div className="divide-y divide-dark-border/30 space-y-3.5">
            {loading ? (
              <span className="text-xs text-indigo-400 font-semibold block text-center py-4">Compiling list...</span>
            ) : !analytics || analytics.top10.length === 0 ? (
              <span className="text-xs text-gray-500 block text-center py-4">No content rankings.</span>
            ) : (
              analytics.top10.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between pt-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`h-6 w-6 rounded-lg font-bold flex items-center justify-center border text-[11px] ${
                      idx === 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      idx === 1 ? 'bg-slate-300/10 text-slate-300 border-slate-300/20' :
                      idx === 2 ? 'bg-amber-700/10 text-amber-700 border-amber-700/20' :
                      'bg-slate-900 border-dark-border text-gray-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="overflow-hidden">
                      <strong className="block text-white truncate max-w-[140px] font-medium">
                        {item.title.split(']')[1] || item.title}
                      </strong>
                      <span className="text-[10px] text-gray-400">By {item.creator_name} &bull; {item.platform}</span>
                    </div>
                  </div>
                  <strong className="font-mono text-indigo-400">{Math.round(item.views / 1000)}k views</strong>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Log Content Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={() => setLogModalOpen(false)} />
          
          <div className="relative w-full max-w-lg p-6 md:p-8 rounded-2xl border border-dark-border bg-slate-950 shadow-2xl z-10 animate-scale-up">
            <button
              onClick={() => setLogModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-900 text-gray-400 hover:text-white border border-dark-border"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-6">Log Uploaded Content</h3>

            {modalError && (
              <div className="p-3 mb-4 rounded-xl text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {modalError}
              </div>
            )}

            {modalSuccess && (
              <div className="p-3 mb-4 rounded-xl text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <CheckCircle2 className="h-4.5 w-4.5" />
                {modalSuccess}
              </div>
            )}

            <form onSubmit={handleLogSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Creator Name</label>
                  <select
                    value={selectedStreamerId}
                    onChange={(e) => setSelectedStreamerId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {streamers.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-950">{s.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="TikTok">TikTok</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                </div>
              </div>

              {/* Registered Account Handles Dropdown */}
              {streamerAccounts.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                    Pilih Akun Sosial Media Terdaftar
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Tanpa Akun Spesifik / Akun Lain --</option>
                    {streamerAccounts
                      .filter(acc => acc.platform.toLowerCase() === platform.toLowerCase())
                      .map(acc => (
                        <option key={acc.id} value={acc.id} className="bg-slate-950">
                          {acc.platform}: {acc.username}
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Content Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cara Konversi Sinyal Casper"
                  className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Upload Date</label>
                  <input
                    type="date"
                    value={uploadDate}
                    onChange={(e) => setUploadDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Content Link URL</label>
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://tiktok.com/@creator/..."
                    className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Engagement metrics inputs */}
              <div className="p-3.5 border border-dark-border/60 bg-slate-900/10 rounded-xl space-y-3">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-dark-border/40 pb-1">Virality metrics</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1 text-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Views</span>
                    <input
                      type="number"
                      value={views}
                      onChange={(e) => setViews(e.target.value)}
                      className="w-full text-center p-1.5 rounded bg-slate-900 border border-dark-border text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1 text-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase flex items-center justify-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" />Likes</span>
                    <input
                      type="number"
                      value={likes}
                      onChange={(e) => setLikes(e.target.value)}
                      className="w-full text-center p-1.5 rounded bg-slate-900 border border-dark-border text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1 text-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase flex items-center justify-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" />Comments</span>
                    <input
                      type="number"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      className="w-full text-center p-1.5 rounded bg-slate-900 border border-dark-border text-white text-xs"
                    />
                  </div>
                  <div className="space-y-1 text-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase flex items-center justify-center gap-0.5"><Share2 className="h-2.5 w-2.5" />Shares</span>
                    <input
                      type="number"
                      value={shares}
                      onChange={(e) => setShares(e.target.value)}
                      className="w-full text-center p-1.5 rounded bg-slate-900 border border-dark-border text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white tracking-wide transition-colors text-xs uppercase"
              >
                Log Video Upload
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Contents;
