'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import { AdminActionLog } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ChevronRight, Filter, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminActionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Viewer Modal State
  const [selectedLog, setSelectedLog] = useState<AdminActionLog | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const fetchLogs = useCallback(async (currentPage: number, entity: string, action: string) => {
    try {
      setIsLoading(true);
      const params: any = { page: currentPage, limit: 15 };
      if (entity !== 'ALL') params.entityType = entity;
      if (action !== 'ALL') params.action = action;
      
      const res = await adminApi.getAuditLogs(params);
      if (res.success && res.data) {
        setLogs(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.pages);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(page, entityFilter, actionFilter);
  }, [fetchLogs, page, entityFilter, actionFilter]);

  const openLogViewer = (log: AdminActionLog) => {
    setSelectedLog(log);
    setIsViewerOpen(true);
  };

  const formatJSON = (data: any) => {
    if (!data) return 'null';
    try {
      if (typeof data === 'string') return data; // Sometimes it's already a string or simple value
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes('APPROVE') || action.includes('RESTORE')) {
      return <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 uppercase tracking-wider">{action}</span>;
    }
    if (action.includes('REJECT') || action.includes('SUSPEND') || action.includes('CANCEL') || action.includes('HIDE')) {
      return <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 uppercase tracking-wider">{action}</span>;
    }
    return <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800 uppercase tracking-wider">{action}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Logs</h1>
          <p className="text-sm text-slate-500">Immutable record of all administrative actions taken on the platform.</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg">System Logs</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-1">
                <Filter className="w-4 h-4 text-slate-400" />
                <Select value={entityFilter} onValueChange={(val: string | null) => { setEntityFilter(val || 'ALL'); setPage(1); }}>
                  <SelectTrigger className="border-0 shadow-none h-8 w-[140px] focus:ring-0">
                    <SelectValue placeholder="Entity Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Entities</SelectItem>
                    <SelectItem value="PRODUCER_VERIFICATION">Producers</SelectItem>
                    <SelectItem value="PRODUCT">Products</SelectItem>
                    <SelectItem value="REVIEW">Reviews</SelectItem>
                    <SelectItem value="ORDER">Orders</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-1">
                <Select value={actionFilter} onValueChange={(val: string | null) => { setActionFilter(val || 'ALL'); setPage(1); }}>
                  <SelectTrigger className="border-0 shadow-none h-8 w-[140px] focus:ring-0">
                    <SelectValue placeholder="Action Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Actions</SelectItem>
                    <SelectItem value="APPROVE">Approve</SelectItem>
                    <SelectItem value="REJECT">Reject</SelectItem>
                    <SelectItem value="SUSPEND">Suspend</SelectItem>
                    <SelectItem value="FORCE_CANCEL">Force Cancel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && logs.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600 bg-red-50">
              {error}
              <Button onClick={() => fetchLogs(page, entityFilter, actionFilter)} variant="outline" className="mt-4 bg-white">Retry</Button>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No logs found</h3>
              <p className="mt-1 text-sm">No administrative actions match your current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Admin</th>
                    <th className="px-6 py-3">Entity</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[13px]">
                  {logs.map((log) => (
                    <tr key={log.id} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-slate-900">
                        {log.admin?.name || log.adminId.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-700">{log.entityType}</span>
                        <div className="text-xs text-slate-400 mt-0.5">{log.entityId}</div>
                      </td>
                      <td className="px-6 py-4">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => openLogViewer(log)}
                        >
                          <Eye className="w-4 h-4 mr-1.5" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50">
              <div className="text-sm text-slate-500 font-sans">
                Page <span className="font-medium text-slate-900">{page}</span> of <span className="font-medium text-slate-900">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* JSON Viewer Modal */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <FileText className="w-5 h-5 text-slate-500" /> 
              Audit Log Detail
            </DialogTitle>
            <DialogDescription>
              Detailed view of the entity changes and administrative action.
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium">Timestamp:</span>
                  <div className="mt-1 text-slate-900">{new Date(selectedLog.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Admin ID:</span>
                  <div className="mt-1 text-slate-900 font-mono">{selectedLog.adminId}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Action:</span>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Entity:</span>
                  <div className="mt-1 text-slate-900 font-mono text-xs">{selectedLog.entityType} ({selectedLog.entityId})</div>
                </div>
                {selectedLog.reason && (
                  <div className="col-span-2">
                    <span className="text-slate-500 font-medium">Reason provided:</span>
                    <div className="mt-1 text-slate-900 bg-white p-2 border border-slate-200 rounded">{selectedLog.reason}</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Previous State</h4>
                  <pre className="bg-slate-900 text-slate-300 p-4 rounded-lg overflow-x-auto text-[11px] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {formatJSON(selectedLog.previousValue)}
                  </pre>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">New State</h4>
                  <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-[11px] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {formatJSON(selectedLog.newValue)}
                  </pre>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button onClick={() => setIsViewerOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
