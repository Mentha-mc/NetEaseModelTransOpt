class JsonToObjConverter {
    constructor() {
        this.convertedFiles = new Map();
        this.fileItems = [];
        this.currentPage = 1;
        this.itemsPerPage = 5;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 标签页切换
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab));
        });

        // 单文件转换
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        
        // 文件夹转换
        const folderDropZone = document.getElementById('folderDropZone');
        const folderInput = document.getElementById('folderInput');
        
        const downloadZip = document.getElementById('downloadZip');

        // 单文件拖放和选择
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
                if (eventName === 'drop') {
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        this.handleFiles(files);
                    }
                }
            });
        });

        // 文件夹拖放和选择
        folderDropZone.addEventListener('click', () => folderInput.click());
        folderInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        folderDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            folderDropZone.classList.add('dragover');
        });

        ['dragleave', 'drop'].forEach(eventName => {
            folderDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                folderDropZone.classList.remove('dragover');
                if (eventName === 'drop') {
                    const items = e.dataTransfer.items;
                    if (items) {
                        Array.from(items).forEach(item => {
                            if (item.kind === 'file') {
                                const file = item.getAsFile();
                                if (file) {
                                    this.handleFiles([file]);
                                }
                            }
                        });
                    }
                }
            });
        });

        downloadZip.addEventListener('click', () => this.downloadAsZip());
    }

    switchTab(selectedTab) {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        selectedTab.classList.add('active');
        const tabId = selectedTab.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    }

    async handleFiles(files) {
        const jsonFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.json'));
        
        if (jsonFiles.length > 0) {
            document.getElementById('downloadZip').disabled = false;
        }

        for (const file of jsonFiles) {
            await this.convertFile(file);
        }
    }

    async convertFile(file) {
        const fileItem = {
            name: file.name,
            status: 'processing',
            error: null
        };
        
        this.fileItems.unshift(fileItem);
        this.renderFileList();

        try {
            const jsonContent = await this.readFileAsText(file);
            const jsonData = JSON.parse(jsonContent);
            
            if (!this.validateJsonStructure(jsonData)) {
                throw new Error('JSON格式不正确。需要包含mesh数组，每个mesh需要包含vertices和indices数组。');
            }
            
            const objContent = this.convertJsonToObj(jsonData);
            this.convertedFiles.set(file.name.replace('.json', '.obj'), objContent);
            
            fileItem.status = 'success';
            
            const downloadBtn = document.getElementById('downloadZip');
            downloadBtn.disabled = false;
            downloadBtn.classList.add('ready');
            
            setTimeout(() => {
                downloadBtn.classList.remove('ready');
            }, 1000);
        } catch (error) {
            fileItem.status = 'error';
            fileItem.error = error.message;
            console.error('转换错误:', error);
        }

        this.renderFileList();
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    validateJsonStructure(jsonData) {
        if (!jsonData.mesh || !Array.isArray(jsonData.mesh)) {
            return false;
        }

        for (const mesh of jsonData.mesh) {
            if (!mesh.vertices || !Array.isArray(mesh.vertices)) {
                return false;
            }
            if (!mesh.indices || !Array.isArray(mesh.indices)) {
                return false;
            }

            for (const vertex of mesh.vertices) {
                if (!vertex.pos || !Array.isArray(vertex.pos) || vertex.pos.length !== 3) {
                    return false;
                }
                if (!vertex.uvcoord || !Array.isArray(vertex.uvcoord) || vertex.uvcoord.length !== 2) {
                    return false;
                }
            }

            for (const triangle of mesh.indices) {
                if (!Array.isArray(triangle) || triangle.length !== 3) {
                    return false;
                }
            }
        }

        return true;
    }

    convertJsonToObj(jsonData) {
        const vertices = [];
        const uvCoords = [];
        
        try {
            for (const mesh of jsonData.mesh) {
                for (const vertex of mesh.vertices) {
                    if (!vertex.pos || !vertex.uvcoord) {
                        throw new Error('顶点数据格式不正确');
                    }
                    vertices.push(vertex.pos);
                    const uv = [vertex.uvcoord[0], 1 - vertex.uvcoord[1]];
                    uvCoords.push(uv);
                }
            }

            let objContent = "";
            
            for (const vertex of vertices) {
                objContent += `v ${vertex[0]} ${vertex[1]} ${vertex[2]}\n`;
            }

            for (const uv of uvCoords) {
                objContent += `vt ${uv[0]} ${uv[1]}\n`;
            }

            let vertexOffset = 0;
            for (const mesh of jsonData.mesh) {
                for (const indices of mesh.indices) {
                    const face = indices.map(index => index + vertexOffset + 1);
                    objContent += `f ${face[0]}/${face[0]} ${face[1]}/${face[1]} ${face[2]}/${face[2]}\n`;
                }
                vertexOffset += mesh.vertices.length;
            }

            return objContent;
        } catch (error) {
            throw new Error(`数据处理错误: ${error.message}`);
        }
    }

    async downloadAsZip() {
        if (this.convertedFiles.size === 0) {
            return;
        }

        const downloadBtn = document.getElementById('downloadZip');
        downloadBtn.disabled = true;
        downloadBtn.textContent = '正在打包...';
        downloadBtn.classList.add('loading');

        try {
            const zip = new JSZip();
            
            for (const [filename, content] of this.convertedFiles) {
                zip.file(filename, content);
            }
            
            const blob = await zip.generateAsync({type: 'blob'});
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = 'converted_models.zip';
            
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            URL.revokeObjectURL(url);

            downloadBtn.textContent = '打包下载所有转换文件';
            downloadBtn.disabled = false;
            downloadBtn.classList.remove('loading');
            downloadBtn.classList.add('success');

            setTimeout(() => {
                downloadBtn.classList.remove('success');
            }, 2000);
        } catch (error) {
            console.error('下载出错:', error);
            downloadBtn.textContent = '下载失败，请重试';
            downloadBtn.disabled = false;
            downloadBtn.classList.remove('loading');
            downloadBtn.classList.add('error');

            setTimeout(() => {
                downloadBtn.classList.remove('error');
                downloadBtn.textContent = '打包下载所有转换文件';
            }, 3000);
        }
    }

    renderFileList() {
        const fileListDiv = document.getElementById('fileList');
        fileListDiv.innerHTML = '';

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentItems = this.fileItems.slice(startIndex, endIndex);

        for (const item of currentItems) {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            
            const fileIcon = document.createElement('div');
            fileIcon.className = 'file-icon';
            fileIcon.innerHTML = '📄';
            
            const fileStatus = document.createElement('div');
            
            if (item.status === 'processing') {
                fileStatus.innerHTML = `
                    <div class="processing-status">
                        <strong>${item.name}</strong>
                        <br>
                        <span class="processing">
                            <span class="loading-dots"></span>
                            正在转换...
                        </span>
                    </div>
                `;
            } else if (item.status === 'success') {
                fileStatus.innerHTML = `
                    <div>
                        <strong>${item.name}</strong>
                        <br>
                        <span class="success">✓ 转换成功!</span>
                    </div>
                `;
            } else {
                fileStatus.innerHTML = `
                    <div>
                        <strong>${item.name}</strong>
                        <br>
                        <span class="error">✗ 转换失败: ${item.error}</span>
                    </div>
                `;
            }
            
            fileInfo.appendChild(fileIcon);
            fileInfo.appendChild(fileStatus);
            fileItem.appendChild(fileInfo);
            fileListDiv.appendChild(fileItem);
        }

        if (this.fileItems.length > this.itemsPerPage) {
            const pagination = document.createElement('div');
            pagination.className = 'pagination';
            fileListDiv.appendChild(pagination);
            this.updatePagination();
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.fileItems.length / this.itemsPerPage);
        const paginationDiv = document.querySelector('.pagination');
        paginationDiv.innerHTML = '';

        if (totalPages <= 1) return;

        const prevBtn = document.createElement('button');
        prevBtn.className = `page-btn prev ${this.currentPage === 1 ? 'disabled' : ''}`;
        prevBtn.textContent = '←';
        prevBtn.dataset.page = (this.currentPage - 1).toString();
        paginationDiv.appendChild(prevBtn);

        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'page-btn';
            firstBtn.textContent = '1';
            firstBtn.dataset.page = '1';
            paginationDiv.appendChild(firstBtn);

            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                paginationDiv.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn ${i === this.currentPage ? 'active' : ''}`;
            pageBtn.textContent = i.toString();
            pageBtn.dataset.page = i.toString();
            paginationDiv.appendChild(pageBtn);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                paginationDiv.appendChild(ellipsis);
            }

            const lastBtn = document.createElement('button');
            lastBtn.className = 'page-btn';
            lastBtn.textContent = totalPages.toString();
            lastBtn.dataset.page = totalPages.toString();
            paginationDiv.appendChild(lastBtn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = `page-btn next ${this.currentPage === totalPages ? 'disabled' : ''}`;
        nextBtn.textContent = '→';
        nextBtn.dataset.page = (this.currentPage + 1).toString();
        paginationDiv.appendChild(nextBtn);

        paginationDiv.addEventListener('click', (e) => {
            const btn = e.target.closest('.page-btn');
            if (btn && !btn.classList.contains('disabled')) {
                this.currentPage = parseInt(btn.dataset.page);
                this.renderFileList();
            }
        });
    }
}

window.addEventListener('load', () => new JsonToObjConverter());