const fs = require("fs")

module.exports = module => {
    const isWindows = !!process.platform.match(/^win/)
    const VFS = Object.assign({}, module.FS)

    const flags = process.binding("constants").fs
    const flagsForNodeMap = {
        [0]: flags.O_RDONLY,
        [1 << 0]: flags.O_WRONLY,
        [1 << 1]: flags.O_RDWR,
        [1 << 6]: flags.O_CREAT,
        [1 << 7]: flags.O_EXCL,
        [1 << 8]: flags.O_NOCTTY,
        [1 << 9]: flags.O_TRUNC,
        [1 << 10]: flags.O_APPEND,
        [1 << 12]: flags.O_SYNC,
    }

    const flagsForNode = (flags) => {
        flags &= ~0x200000 /*O_PATH*/ // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~0x800 /*O_NONBLOCK*/ // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~0x8000 /*O_LARGEFILE*/ // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~0x80000 /*O_CLOEXEC*/ // Some applications may pass it it makes no sense for a single process.
        let newFlags = 0
        for (const k in flagsForNodeMap) {
            if (flags & k) {
                newFlags |= flagsForNodeMap[k]
                flags ^= k
            }
        }

        if (!flags) {
            return newFlags
        } else {
            throw new Error('Invalid flag value')
        }
    }

    const rawFS = {
        lookupPath: (path) => {
            let stat
            try {
                stat = fs.lstatSync(path)
                if (isWindows) {
                    // Node.js on Windows never represents permission bit 'x', so
                    // propagate read bits to execute bits
                    stat.mode = stat.mode | ((stat.mode & 292) >> 2)
                }
            } catch (e) {
                if (!e.code) throw e
                throw new module.FS.ErrnoError(e)
            }
            return {
                path: path,
                node: {
                    mode: stat.mode
                }
            }
        },
        createStandardStreams: () => {
            module.FS.streams[0] = {
                fd: 0,
                nfd: 0,
                position: 0,
                path: '',
                flags: 0,
                tty: true,
                seekable: false
            }
            for (let i = 1; i < 3; i++) {
                module.FS.streams[i] = {
                    fd: i,
                    nfd: i,
                    position: 0,
                    path: '',
                    flags: 577,
                    tty: true,
                    seekable: false
                }
            }
        },
        cwd: () => process.cwd(),
        chdir: () => process.chdir.apply(void 0, arguments),
        mknod: (path, mode) => {
            if (module.FS.isDir(path)) {
                fs.mkdirSync(path, mode)
            } else {
                fs.writeFileSync(path, '', {
                    mode: mode
                })
            }
        },
        mkdir: fs.mkdirSync,
        symlink: fs.symlinkSync,
        rename: fs.renameSync,
        rmdir: fs.rmdirSync,
        readdir: fs.readdirSync,
        unlink: fs.unlinkSync,
        readlink: fs.readlinkSync,
        stat: fs.statSync,
        lstat: fs.lstatSync,
        chmod: fs.chmodSync,
        fchmod: fs.fchmodSync,
        chown: fs.chownSync,
        fchown: fs.fchownSync,
        truncate: fs.truncateSync,
        ftruncate: (fd, len) => {
            if (len < 0) {
                throw new FS.ErrnoError("Invalid truncate length")
            }
            fs.ftruncateSync.apply(void 0, arguments)
        },
        utime: fs.utimesSync,
        open: (path, flags, mode, suggestFD) => {
            if (typeof flags === "string") {
                flags = VFS.modeStringToFlags(flags)
            }
            try {
                const nfd = fs.openSync(path, flagsForNode(flags), mode)
                const fd = suggestFD != null ? suggestFD : module.FS.nextfd(nfd)
                const stream = {
                    fd: fd,
                    nfd: nfd,
                    position: 0,
                    path: path,
                    flags: flags,
                    seekable: true
                }
                module.FS.streams[fd] = stream
                return stream
            } catch (e) {
                throw new module.FS.ErrnoError(44)
            }
        },
        close: (stream) => {
            if (!stream.stream_ops) {
                // this stream is created by in-memory filesystem
                fs.closeSync(stream.nfd)
            }
            module.FS.closeStream(stream.fd)
        },
        llseek: (stream, offset, whence) => {
            if (stream.stream_ops) {
                // this stream is created by in-memory filesystem
                return VFS.llseek(stream, offset, whence)
            }

            let position = offset
            if (whence === 1) {
                position += stream.position
            } else if (whence === 2) {
                position += fs.fstatSync(stream.nfd).size
            } else if (whence !== 0) {
                throw new FS.ErrnoError(28)
            }

            if (position < 0) {
                throw new FS.ErrnoError(28)
            }
            stream.position = position
            return position
        },
        read: (stream, buffer, offset, length, position) => {
            if (stream.stream_ops) {
                // this stream is created by in-memory filesystem
                return VFS.read(stream, buffer, offset, length, position)
            }
            const seeking = typeof position !== 'undefined'
            if (!seeking && stream.seekable) position = stream.position
            const bytesRead = fs.readSync(stream.nfd, Buffer.from(buffer.buffer), offset, length, position)
            // update position marker when non-seeking
            if (!seeking) stream.position += bytesRead
            return bytesRead
        },
        write: (stream, buffer, offset, length, position) => {
            if (stream.stream_ops) {
                // this stream is created by in-memory filesystem
                return VFS.write(stream, buffer, offset, length, position)
            }
            if (stream.flags & +"{{{ cDefine('O_APPEND') }}}") {
                // seek to the end before writing in append mode
                module.FS.llseek(stream, 0, +"{{{ cDefine('SEEK_END') }}}")
            }
            const seeking = typeof position !== 'undefined'
            if (!seeking && stream.seekable) position = stream.position
            const bytesWritten = fs.writeSync(stream.nfd, Buffer.from(buffer.buffer), offset, length, position)
            // update position marker when non-seeking
            if (!seeking) stream.position += bytesWritten
            return bytesWritten
        },
        allocate: () => {
            throw new FS.ErrnoError('Allocation operation not supported')
        },
        mmap: (stream, address, length, position, prot, flags) => {
            if (stream.stream_ops) {
                // this stream is created by in-memory filesystem
                return VFS.mmap(stream, address, length, position, prot, flags)
            }
            if (address !== 0) {
                // We don't currently support location hints for the address of the mapping
                throw new FS.ErrnoError('Invalid address value')
            }

            throw new Error('mmap not supported')
        },
        msync: (stream, buffer, offset, length, mmapFlags) => {
            if (stream.stream_ops) {
                // this stream is created by in-memory filesystem
                return VFS.msync(stream, buffer, offset, length, mmapFlags)
            }

            if (mmapFlags & 2) {
                // MAP_PRIVATE calls need not to be synced back to underlying fs
                return 0
            }

            module.FS.write(stream, buffer, 0, length, offset)
            return 0
        },
        munmap: () => 0,
        ioctl: () => {
            throw new FS.ErrnoError('ioctl not supported')
        }
    }

    for (const key in rawFS) {
        module.FS[key] = rawFS[key]
    }
}