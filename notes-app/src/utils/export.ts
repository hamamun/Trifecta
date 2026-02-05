import jsPDF from 'jspdf';

export type ExportFormat = 'json' | 'pdf' | 'csv';

interface ExportItem {
  id: string;
  title: string;
  [key: string]: any;
}

// Generate filename with timestamp
function generateFilename(prefix: string, format: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}-${date}.${format}`;
}

// Download file helper
function downloadFile(content: string | Blob, filename: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export as JSON
export function exportAsJSON(items: ExportItem[], type: 'lists' | 'notes' | 'events') {
  const data = JSON.stringify(items, null, 2);
  const filename = generateFilename(`${type}-export`, 'json');
  downloadFile(data, filename, 'application/json');
}

// Export Lists as PDF
export function exportListsAsPDF(lists: any[]) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('Lists Export', 14, 20);
  doc.setFontSize(10);
  doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 14, 28);

  let yPosition = 40;

  lists.forEach((list) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    // List title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(list.title, 14, yPosition);
    yPosition += 8;

    // List items
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (list.items && list.items.length > 0) {
      list.items.forEach((item: any) => {
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
        const checkbox = item.checked ? '☑' : '☐';
        doc.text(`${checkbox} ${item.text}`, 20, yPosition);
        yPosition += 6;
      });
    } else {
      doc.setTextColor(150);
      doc.text('(No items)', 20, yPosition);
      doc.setTextColor(0);
      yPosition += 6;
    }

    yPosition += 10;
  });

  const filename = generateFilename('lists-export', 'pdf');
  doc.save(filename);
}

// Export Notes as PDF
export function exportNotesAsPDF(notes: any[]) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('Notes Export', 14, 20);
  doc.setFontSize(10);
  doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 14, 28);

  let yPosition = 40;

  notes.forEach((note) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    // Note title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(note.title, 14, yPosition);
    yPosition += 8;

    // Note content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const lines = doc.splitTextToSize(note.content || '(No content)', 180);
    lines.forEach((line: string) => {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, 14, yPosition);
      yPosition += 6;
    });

    // Metadata
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Created: ${new Date(note.createdAt).toLocaleDateString()}`, 14, yPosition + 4);
    doc.setTextColor(0);
    
    yPosition += 15;
  });

  const filename = generateFilename('notes-export', 'pdf');
  doc.save(filename);
}

// Export Events as PDF
export function exportEventsAsPDF(events: any[]) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('Events Export', 14, 20);
  doc.setFontSize(10);
  doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 14, 28);

  let yPosition = 40;

  events.forEach((event) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    // Event title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(event.title, 14, yPosition);
    yPosition += 10;

    // Event entries
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (event.entries && event.entries.length > 0) {
      event.entries.forEach((entry: any) => {
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(new Date(entry.date).toLocaleDateString(), 20, yPosition);
        doc.setFont('helvetica', 'normal');
        yPosition += 6;
        
        const lines = doc.splitTextToSize(entry.description, 170);
        lines.forEach((line: string) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 25, yPosition);
          yPosition += 6;
        });
        
        yPosition += 4;
      });
    } else {
      doc.setTextColor(150);
      doc.text('(No entries)', 20, yPosition);
      doc.setTextColor(0);
      yPosition += 6;
    }

    yPosition += 10;
  });

  const filename = generateFilename('events-export', 'pdf');
  doc.save(filename);
}

// Export as CSV
export function exportAsCSV(items: any[], type: 'lists' | 'notes' | 'events') {
  let csv = '';
  
  if (type === 'lists') {
    csv = 'Title,Item,Checked,Created Date\n';
    items.forEach(list => {
      if (list.items && list.items.length > 0) {
        list.items.forEach((item: any) => {
          csv += `"${list.title}","${item.text}","${item.checked}","${new Date(list.createdAt).toLocaleDateString()}"\n`;
        });
      } else {
        csv += `"${list.title}","(No items)","","${new Date(list.createdAt).toLocaleDateString()}"\n`;
      }
    });
  } else if (type === 'notes') {
    csv = 'Title,Content,Created Date,Updated Date\n';
    items.forEach(note => {
      const content = (note.content || '').replace(/"/g, '""');
      csv += `"${note.title}","${content}","${new Date(note.createdAt).toLocaleDateString()}","${new Date(note.updatedAt).toLocaleDateString()}"\n`;
    });
  } else if (type === 'events') {
    csv = 'Event Title,Date,Description,Created Date\n';
    items.forEach(event => {
      if (event.entries && event.entries.length > 0) {
        event.entries.forEach((entry: any) => {
          const desc = (entry.description || '').replace(/"/g, '""');
          csv += `"${event.title}","${new Date(entry.date).toLocaleDateString()}","${desc}","${new Date(event.createdAt).toLocaleDateString()}"\n`;
        });
      } else {
        csv += `"${event.title}","","(No entries)","${new Date(event.createdAt).toLocaleDateString()}"\n`;
      }
    });
  }

  const filename = generateFilename(`${type}-export`, 'csv');
  downloadFile(csv, filename, 'text/csv');
}
