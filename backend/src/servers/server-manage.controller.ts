import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards,
  ParseIntPipe, HttpCode, BadRequestException,
} from '@nestjs/common';
import { ServerManageService } from './server-manage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('servers/:serverId/manage')
@UseGuards(JwtAuthGuard)
export class ServerManageController {
  constructor(private svc: ServerManageService) {}

  // ── Power & Console ──────────────────────────────────────────────────────

  @Get('resources')
  resources(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.getResources(id, u.id);
  }

  @Get('logs')
  logs(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Query('size') size?: string,
  ) {
    return this.svc.getLogs(id, u.id, size ? parseInt(size, 10) : undefined);
  }

  @Post('power')
  @HttpCode(200)
  power(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body('action') action: string,
  ) {
    if (!['start', 'stop', 'restart', 'kill'].includes(action))
      throw new BadRequestException('Invalid power action');
    return this.svc.sendPower(id, u.id, action as any);
  }

  @Post('command')
  @HttpCode(200)
  command(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body('command') command: string,
  ) {
    return this.svc.sendCommand(id, u.id, command);
  }

  // ── Files ────────────────────────────────────────────────────────────────

  @Get('files/list')
  fileList(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Query('directory') dir?: string,
  ) {
    return this.svc.listFiles(id, u.id, dir || '/');
  }

  @Get('files/contents')
  fileContents(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Query('file') file: string,
  ) {
    return this.svc.getFileContents(id, u.id, file);
  }

  @Post('files/write')
  @HttpCode(200)
  fileWrite(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body() body: { file: string; content: string },
  ) {
    return this.svc.writeFile(id, u.id, body.file, body.content);
  }

  @Post('files/delete')
  @HttpCode(200)
  fileDelete(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body() body: { root: string; files: string[] },
  ) {
    return this.svc.deleteFiles(id, u.id, body.root, body.files);
  }

  @Post('files/create-folder')
  @HttpCode(200)
  createFolder(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body() body: { root: string; name: string },
  ) {
    return this.svc.createDirectory(id, u.id, body.root, body.name);
  }

  @Put('files/rename')
  renameFile(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body() body: { root: string; from: string; to: string },
  ) {
    return this.svc.renameFile(id, u.id, body.root, body.from, body.to);
  }

  @Get('files/upload-url')
  uploadUrl(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.getUploadUrl(id, u.id);
  }

  @Post('plugins/install')
  @HttpCode(200)
  installPlugin(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body() body: { downloadUrl: string; filename: string; directory: string },
  ) {
    return this.svc.installPlugin(id, u.id, body.downloadUrl, body.filename, body.directory);
  }

  // ── Startup / Variables ──────────────────────────────────────────────────

  @Get('startup')
  startup(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.getStartup(id, u.id);
  }

  @Put('startup/variable')
  updateVariable(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body() body: { key: string; value: string },
  ) {
    return this.svc.updateVariable(id, u.id, body.key, body.value);
  }

  @Post('version/switch')
  @HttpCode(200)
  switchMinecraftVersion(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body('version') version: string,
  ) {
    return this.svc.switchMinecraftVersion(id, u.id, version);
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  @Post('settings/rename')
  @HttpCode(200)
  rename(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body('name') name: string,
  ) {
    return this.svc.rename(id, u.id, name);
  }

  @Post('settings/reinstall')
  @HttpCode(200)
  reinstall(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.reinstall(id, u.id);
  }

  // ── EULA ─────────────────────────────────────────────────────────────────

  @Get('eula')
  checkEula(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.checkEula(id, u.id);
  }

  @Post('eula/accept')
  @HttpCode(200)
  acceptEula(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.acceptEula(id, u.id);
  }

  // ── Network ──────────────────────────────────────────────────────────────

  @Get('network')
  network(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.getNetwork(id, u.id);
  }

  // ── SFTP ─────────────────────────────────────────────────────────────────

  @Get('sftp')
  sftpDetails(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.getSftpDetails(id, u.id);
  }

  @Post('sftp/reset-password')
  @HttpCode(200)
  resetSftpPassword(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.resetSftpPassword(id, u.id);
  }

  // ── Subdomain ────────────────────────────────────────────────────────────

  @Get('subdomain')
  getSubdomain(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.getSubdomain(id, u.id);
  }

  @Post('subdomain')
  @HttpCode(200)
  setSubdomain(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body('subdomain') subdomain: string,
  ) {
    return this.svc.setSubdomain(id, u.id, subdomain);
  }

  @Delete('subdomain')
  @HttpCode(200)
  removeSubdomain(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.removeSubdomain(id, u.id);
  }

  // ── Players ──────────────────────────────────────────────────────────────

  @Get('players')
  players(@Param('serverId', ParseIntPipe) id: number, @CurrentUser() u: any) {
    return this.svc.getPlayers(id, u.id);
  }

  @Post('players/kick')
  @HttpCode(200)
  kickPlayer(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body('player') player: string,
  ) {
    return this.svc.kickPlayer(id, u.id, player);
  }

  @Post('players/ban')
  @HttpCode(200)
  banPlayer(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body('player') player: string,
  ) {
    return this.svc.banPlayer(id, u.id, player);
  }

  @Post('players/op')
  @HttpCode(200)
  opPlayer(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body('player') player: string,
  ) {
    return this.svc.opPlayer(id, u.id, player);
  }

  @Post('players/deop')
  @HttpCode(200)
  deopPlayer(
    @Param('serverId', ParseIntPipe) id: number,
    @CurrentUser() u: any,
    @Body('player') player: string,
  ) {
    return this.svc.deopPlayer(id, u.id, player);
  }
}
