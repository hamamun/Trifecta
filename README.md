# Trifecta

**All-in-one secure app for Notes, Lists, and Events**

A modern, feature-rich Progressive Web App (PWA) for managing your notes, to-do lists, and events with real-time GitHub sync, PIN protection, and offline support.

## ✨ Features

### 📝 Notes
- Rich text notes with images
- Color coding and tagging
- Pin important notes
- Archive and trash management
- Multiple view modes (Comfortable, Compact, List, Masonry, Table, Magazine)
- Smart sorting (Smart, A-Z, Z-A, Newest, Oldest)
- Text selection and copy support
- Linkify URLs automatically

### ✅ Lists
- Create and manage to-do lists
- Check/uncheck items
- Color coding and tagging
- Pin important lists
- Archive and trash management
- Same view modes and sorting as Notes

### 📅 Events
- Create events with date and time
- Color coding and tagging
- Pin important events
- Archive and trash management
- Same view modes and sorting as Notes

### 🔒 Security
- PIN protection for Notes and Events
- Auto-lock with configurable timeout (1-60 minutes or Never)
- Failed attempt tracking with lockout
- Secure session management

### ☁️ Cloud Sync
- Real-time GitHub sync (30-second auto-sync)
- Conflict detection and resolution
- Multi-device support
- Version control for all items
- Automatic backup (Daily, Weekly, Monthly)
- Restore from backup
- Offline mode support

### 🎨 Customization
- Dark/Light/System theme
- Adjustable font size (Small, Medium, Large)
- 9 color options for items
- Custom tags with visibility toggle
- Multiple view modes
- Flexible sorting options

### 📱 Mobile-First
- Progressive Web App (PWA)
- Install on any device
- Offline support
- Touch-optimized interface
- Responsive design
- Swipe gesture protection

### 🔄 Multi-Select
- Bulk operations (Delete, Archive, Pin, Export)
- Select multiple items at once
- Works across all sections

### 📤 Export
- Export as JSON
- Export as PDF
- Export as CSV
- Export selected items or all

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- GitHub account (for sync feature)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/namamun/Trifecta.git
cd Trifecta/notes-app
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

5. Preview production build:
```bash
npm run preview
```

## 🔧 Configuration

### GitHub Sync Setup

1. Create a GitHub Personal Access Token:
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Give it a name (e.g., "Trifecta Sync")
   - Select scopes: `repo` (Full control of private repositories)
   - Click "Generate token"
   - Copy the token (you won't see it again!)

2. Connect in the app:
   - Open Trifecta
   - Go to Settings → Cloud & Backup
   - Paste your GitHub token
   - Click "Connect"

3. The app will automatically:
   - Create a `my-notes-data` repository in your GitHub account
   - Set up sync workflows
   - Start syncing your data

### Data Repository Structure

Your `my-notes-data` repository will contain:
```
my-notes-data/
├── v3/
│   ├── lists/          # All lists
│   ├── notes/          # All notes
│   └── events/         # All events
├── deleted-items.json  # Deleted items tracking
├── sync-status.json    # Sync status and metadata
├── conflicts/          # Conflict reports (if any)
└── backups/            # Automatic backups
    ├── daily/
    ├── weekly/
    └── monthly/
```

## 📖 Usage

### Basic Operations

**Create:**
- Click the "+" button in any section
- Add title, content, and optional images
- Choose color and tags
- Save

**Edit:**
- Click on any item to view
- Click edit icon to modify
- Save changes

**Delete:**
- Swipe left on item or use delete button
- Items move to Trash
- Permanently delete from Trash

**Archive:**
- Use archive button on items
- Access archived items from Archive section
- Restore when needed

### Multi-Select Mode

1. Click the multi-select icon (checkbox)
2. Select multiple items
3. Use bulk actions:
   - Delete selected
   - Archive selected
   - Pin/Unpin selected
   - Export selected

### PIN Protection

1. Go to Settings → Security
2. Click "Set PIN"
3. Enter 4-6 digit PIN
4. Confirm PIN
5. Configure auto-lock timeout

**Protected Sections:**
- Notes (PIN required)
- Events (PIN required)
- Lists (Always accessible)

### Sync & Backup

**Manual Sync:**
- Go to Settings → Cloud & Backup
- Click "Sync Now"

**Auto Sync:**
- Runs every 30 seconds automatically
- Syncs all changes across devices

**Backup:**
- Enable automatic backup
- Choose frequency (Daily, Weekly, Monthly)
- Backup now or restore from backup

### Conflict Resolution

If conflicts are detected:
1. A notification will appear
2. Go to Settings → Cloud & Backup
3. Click "View Conflicts"
4. Choose which version to keep:
   - Version A (your device)
   - Version B (other device)
   - Manual merge

## 🛠️ Technology Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **PWA:** vite-plugin-pwa
- **GitHub API:** @octokit/rest
- **PDF Export:** html2canvas + jsPDF
- **Routing:** React Router
- **State Management:** React Hooks

## 📱 Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Android)

## 🔐 Privacy & Security

- All data stored locally in browser
- GitHub sync uses your personal repository
- PIN protection with secure hashing
- No third-party analytics or tracking
- No data collection
- Open source - audit the code yourself

## 🐛 Known Issues

- Browser 404 errors in console when checking for conflicts (harmless, expected behavior)
- Service worker connection warnings (PWA-related, doesn't affect functionality)

## 📝 License

This project is open source and available under the MIT License.

## 👤 Author

**hamamun**
- GitHub: [@hamamun](https://github.com/namamun)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you have any questions or need help:
- Open an issue on GitHub
- Check existing issues for solutions

## 🙏 Acknowledgments

- Built with React and TypeScript
- Icons by Lucide
- Inspired by modern note-taking apps
- Thanks to the open-source community

---

**Version:** 2.0.0  
**Last Updated:** February 2026

Made with ❤️ by namamun
