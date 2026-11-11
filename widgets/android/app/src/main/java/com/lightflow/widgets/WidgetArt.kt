package com.lightflow.widgets

import android.graphics.*
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.*

/** The only RemoteViews child is an ImageView: all detail is safely drawn off-screen. */
internal object WidgetArt {
    enum class Kind { BULB, COMPACT_DIAL, DIAL }
    private val bg=Color.rgb(15,27,42)
    private val bgHighlight=Color.rgb(26,45,64)
    private val edge=Color.rgb(78,101,123)
    private val text=Color.rgb(248,250,255)
    private val muted=Color.rgb(173,193,210)
    private val green=Color.rgb(108,231,186)
    private val red=Color.rgb(242,118,131)
    private val gray=Color.rgb(138,156,174)
    private val amber=Color.rgb(255,186,57)
    private val gold=Color.rgb(255,211,131)
    private val font=Typeface.create("sans-serif",Typeface.NORMAL)
    private val medium=Typeface.create("sans-serif-medium",Typeface.NORMAL)
    private val bold=Typeface.create("sans-serif",Typeface.BOLD)

    private fun paint(color:Int,stroke:Float=1f,style:Paint.Style=Paint.Style.FILL)=
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color=color; strokeWidth=stroke; this.style=style
            strokeCap=Paint.Cap.ROUND; strokeJoin=Paint.Join.ROUND
        }
    private fun write(c:Canvas,s:String,x:Float,y:Float,size:Float,col:Int=text,
                      type:Typeface=font) {
        // A restrained dark keyline/shadow keeps text readable on light or busy wallpapers.
        val outline=paint(Color.argb(130,6,15,25),size*.090f,Paint.Style.STROKE).apply {
            textSize=size; textAlign=Paint.Align.CENTER; typeface=type
        }
        if(col==text || col==muted) c.drawText(s,x,y,outline)
        c.drawText(s,x,y,paint(col).apply {
            textSize=size; textAlign=Paint.Align.CENTER; typeface=type
            if(col==text || col==muted) setShadowLayer(size*.14f,0f,size*.04f,Color.argb(160,6,15,25))
        })
    }
    private fun polarX(cx:Float,r:Float,a:Double)=cx+cos(a).toFloat()*r
    private fun polarY(cy:Float,r:Float,a:Double)=cy+sin(a).toFloat()*r
    private fun nowPeriod(data:Schedule?,now:ZonedDateTime):Period? {
        val current=now.hour*60+now.minute+now.second/60f
        return data?.periods?.firstOrNull {
            val from=minutes(it.start) ?: 0
            val to=minutes(it.end) ?: 1440
            current>=from && current<to
        }
    }
    // No card fill or frame: all pixels outside the actual artwork remain transparent.

    private fun bulb(c: Canvas,w: Float,h: Float,data: Schedule?,now: ZonedDateTime) {
        val state=nowPeriod(data,now)
        val accent=when(state?.off) { true->red;false->gold;null->gray }
        val boltColor=if(state==null)gray else amber
        val side=min(w,h); val x=w*.5f; val y=h*.393f; val r=side*.166f
        // A restrained halo behind a crisp, symmetric glass outline.
        c.drawCircle(x,y-r*.23f,r*1.8f,paint(Color.TRANSPARENT).apply {
            shader=RadialGradient(x,y-r*.23f,r*1.8f,
                intArrayOf(Color.argb(52,Color.red(accent),Color.green(accent),
                    Color.blue(accent)),Color.TRANSPARENT),
                null,Shader.TileMode.CLAMP)
        })
        val glass=Path().apply {
            moveTo(x-r*.64f,y+r*.62f)
            cubicTo(x-r*1.74f,y-r*.35f,x-r*1.06f,y-r*1.77f,x,y-r*1.76f)
            cubicTo(x+r*1.06f,y-r*1.77f,x+r*1.74f,y-r*.35f,x+r*.64f,y+r*.62f)
            cubicTo(x+r*.41f,y+r*.88f,x+r*.34f,y+r*1.02f,x+r*.34f,y+r*1.14f)
            lineTo(x-r*.34f,y+r*1.14f)
            cubicTo(x-r*.34f,y+r*1.02f,x-r*.41f,y+r*.88f,x-r*.64f,y+r*.62f)
            close()
        }
        c.drawPath(glass,paint(accent,side*.0115f,Paint.Style.STROKE).apply {
            setShadowLayer(side*.022f,0f,0f,accent)
        })
        val bolt=Path().apply {
            moveTo(x+r*.09f,y-r*.84f)
            lineTo(x-r*.38f,y+r*.12f)
            lineTo(x-r*.06f,y+r*.12f)
            lineTo(x-r*.16f,y+r*.70f)
            lineTo(x+r*.40f,y-r*.29f)
            lineTo(x+r*.07f,y-r*.29f)
            close()
        }
        c.drawPath(bolt,paint(boltColor))
        for(i in 0..1) {
            c.drawLine(x-r*.37f,y+r*(1.33f+i*.20f),
                x+r*.37f,y+r*(1.33f+i*.20f),
                paint(accent,side*.012f))
        }
        // No header or status caption: exactly one time interval below the bulb.
        val interval=if(state==null) "--:--–--:--" else state.start+"–"+state.end
        write(c,interval,x,h*.855f,side*.084f,text,medium)
    }
    private fun dial(c:Canvas,w:Float,h:Float,data:Schedule?,now:ZonedDateTime,compact:Boolean=false) {
        val side=min(w,h)
        val cx=w*.5f;val cy=h*.505f
        val radius=side*(if(compact) .330f else .344f)
        val thickness=side*(if(compact) .106f else .101f)
        val outer=radius+thickness*.5f
        val inner=radius-thickness*.5f
        val bounds=RectF(cx-radius,cy-radius,cx+radius,cy+radius)
        c.drawCircle(cx,cy,radius,paint(edge,thickness,Paint.Style.STROKE))

        // Time intervals are preserved to the minute; the separators are just visual.
        if(data!=null)for(segment in data.periods) {
            val start=minutes(segment.start) ?: continue
            val end=minutes(segment.end) ?: continue
            val light=if(segment.off)Color.rgb(249,130,143) else Color.rgb(112,230,183)
            val shade=if(segment.off)Color.rgb(220,95,112) else Color.rgb(57,190,150)
            c.drawArc(bounds,-90f+start/4f,(end-start)/4f,false,
                paint(light,thickness,Paint.Style.STROKE).apply {
                    strokeCap=Paint.Cap.BUTT
                    shader=LinearGradient(cx-radius,cy-radius,cx+radius,cy+radius,
                        light,shade,Shader.TileMode.CLAMP)
                })
        }
        c.drawCircle(cx,cy,outer,
            paint(Color.argb(95,187,208,218),side*.0022f,Paint.Style.STROKE))
        c.drawCircle(cx,cy,inner,
            paint(Color.argb(130,187,208,218),side*.0019f,Paint.Style.STROKE))
        for(hour in 0..23) {
            val angle=Math.toRadians((-90+hour*15).toDouble())
            c.drawLine(polarX(cx,inner-1f,angle),
                polarY(cy,inner-1f,angle),
                polarX(cx,outer+1f,angle),
                polarY(cy,outer+1f,angle),
                paint(bg,side*.0025f))
            // In the 2×2 version, show eight well-spaced labels; 24 colored hours remain.
            if(!compact || hour % 3 == 0) {
                val labelSize=side*(if(compact) .045f else .035f)
                write(c,hour.toString(),polarX(cx,outer+side*.038f,angle),
                    polarY(cy,outer+side*.038f,angle)+side*.011f,
                    labelSize,text,medium)
            }
        }

        // Short white hand + white circle at the ring, no arrowhead crossing centre.
        val elapsed=now.hour*3600+now.minute*60+now.second
        val angle=Math.toRadians(-90+elapsed/86400.0*360.0)
        val markRadius=radius+thickness*.31f
        val px=polarX(cx,markRadius,angle);val py=polarY(cy,markRadius,angle)
        c.drawLine(polarX(cx,inner-side*.018f,angle),
            polarY(cy,inner-side*.018f,angle),px,py,paint(text,side*.0042f))
        c.drawCircle(px,py,side*.011f,paint(text))

        val current=nowPeriod(data,now)
        val accent=when(current?.off){true->red;false->green;null->gray}
        val status=when(current?.off){
            true->"Відключення"
            false->"Світло за графіком"
            null->"Статус невідомий"
        }
        if(compact) {
            // The big ring's layout, carefully scaled for a real 2×2 home-screen widget.
            // Keep the date, subqueue and state; abbreviate secondary labels for clarity.
            write(c,now.format(DateTimeFormatter.ofPattern("d MMM",Locale("uk"))),
                cx,cy-side*.138f,side*.043f,muted,medium)
            write(c,"1.1",cx,cy+side*.014f,side*.145f,text,bold)
            val shortStatus=when(current?.off){
                true->"Відключення"
                false->"Є світло"
                null->"Невідомо"
            }
            val statusSize=side*(if(shortStatus.length>9) .037f else .043f)
            write(c,shortStatus,cx,cy+side*.106f,statusSize,accent,medium)
            write(c,"за графіком",cx,cy+side*.152f,side*.030f,muted,medium)
        } else {
            write(c,now.format(DateTimeFormatter.ofPattern("d MMMM",Locale("uk"))),
                cx,cy-side*.152f,side*.047f,muted,medium)
            write(c,"1.1",cx,cy-side*.017f,side*.128f,text,bold)
            write(c,"ПІДЧЕРГА",cx,cy+side*.038f,side*.030f,muted,medium)
            c.drawLine(cx-side*.139f,cy+side*.081f,
                cx+side*.139f,cy+side*.081f,
                paint(Color.rgb(93,116,133),side*.0018f))
            write(c,status,cx,cy+side*.143f,side*.043f,accent,medium)
        }
    }

    fun draw(kind:Kind,schedule:Schedule?,now:ZonedDateTime):Bitmap {
        // Bounded ARGB_8888 images stay well below the widget binder bitmap quota.
        val size=when(kind){
            Kind.BULB->340 to 340
            Kind.COMPACT_DIAL->430 to 430
            Kind.DIAL->630 to 630
        }
        val cBitmap=Bitmap.createBitmap(size.first,size.second,Bitmap.Config.ARGB_8888)
        val canvas=Canvas(cBitmap)
        // Fresh ARGB_8888 bitmaps start with alpha 0: transparent wallpaper shows through.
        // Do not paint any rectangular panel, including behind the 24-hour circle.
        when(kind){
            Kind.BULB->bulb(canvas,size.first.toFloat(),size.second.toFloat(),schedule,now)
            Kind.COMPACT_DIAL->dial(canvas,size.first.toFloat(),size.second.toFloat(),schedule,now,compact=true)
            Kind.DIAL->dial(canvas,size.first.toFloat(),size.second.toFloat(),schedule,now)
        }
        return cBitmap
    }
}
