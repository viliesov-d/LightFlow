package com.lightflow.widgets

import android.graphics.*
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.*

/** The only RemoteViews child is an ImageView: all detail is safely drawn off-screen. */
internal object WidgetArt {
    enum class Kind { BULB, CAROUSEL, DIAL }
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
        c.drawText(s,x,y,paint(col).apply {textSize=size;textAlign=Paint.Align.CENTER;typeface=type})
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
    private fun base(c: Canvas, w: Float, h: Float) {
        val radius = min(w,h)*.118f
        val rect = RectF(1.5f,1.5f,w-1.5f,h-1.5f)
        c.drawRoundRect(rect,radius,radius,paint(bg).apply {
            shader = LinearGradient(0f,0f,w,h,
                intArrayOf(bgHighlight,bg,Color.rgb(12,24,38)),
                floatArrayOf(0f,.53f,1f),Shader.TileMode.CLAMP)
        })
        c.drawRoundRect(rect,radius,radius,paint(edge,1.7f,Paint.Style.STROKE))
    }

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
    private fun strip(c: Canvas,w: Float,h: Float,data: Schedule?,now: ZonedDateTime) {
        val current=nowPeriod(data,now)
        val periods=data?.periods.orEmpty()
        val index=periods.indexOf(current)
        val accent=when(current?.off) {true->red;false->green;null->gray}
        val status=when(current?.off) {
            true->"Відключення"
            false->"Є світло"
            null->"Немає актуальних даних"
        }
        // The chosen reference: quiet left-aligned title above slim, glowing pills.
        c.drawCircle(w*.067f,h*.226f,h*.024f,paint(accent))
        c.drawText(status,w*.099f,h*.287f,paint(text).apply {
            textSize=h*.157f
            typeface=medium
        })
        val center=w*.5f
        val segmentWidth=w*.66f   // 66% of visible carousel width.
        val gap=w*.016f
        val top=h*.391f
        val bottom=h*.707f
        val radius=(bottom-top)*.47f
        c.save()
        c.clipRect(w*.023f,top-4f,w*.977f,bottom+4f)
        if(index<0) {
            c.drawRoundRect(center-segmentWidth*.5f,top,
                center+segmentWidth*.5f,bottom,radius,radius,paint(edge))
            write(c,"--:--–--:--",center,h*.594f,h*.17f,text,medium)
        } else {
            val start=minutes(current!!.start) ?: 0
            val end=minutes(current.end) ?: 1440
            val time=now.hour*60f+now.minute+now.second/60f
            val progress=((time-start)/(end-start).coerceAtLeast(1)).coerceIn(0f,1f)
            // Fixed central pointer, while cards glide slowly according to phone time.
            // This keeps the current 66%-width block mostly in view, unlike the old clipping.
            val activeLeft=(w-segmentWidth)*.5f+(.5f-progress)*w*.25f
            for(i in periods.indices) {
                if(i<index-2||i>index+2)continue
                val segment=periods[i]
                val x=activeLeft+(i-index)*(segmentWidth+gap)
                if(x>w||x+segmentWidth<0f)continue
                val active=i==index
                val accentColor=if(segment.off)red else green
                val leftFill=if(segment.off)Color.rgb(231,119,132) else Color.rgb(122,237,190)
                val rightFill=if(segment.off)Color.rgb(175,75,92) else Color.rgb(55,191,147)
                val rect=RectF(x,top,x+segmentWidth,bottom)
                if(active) {
                    c.drawRoundRect(rect,radius,radius,
                        paint(accentColor,2.4f,Paint.Style.STROKE).apply {
                            setShadowLayer(h*.062f,0f,0f,accentColor)
                        })
                }
                c.drawRoundRect(rect,radius,radius,paint(leftFill).apply {
                    shader=LinearGradient(x,top,x+segmentWidth,bottom,
                        leftFill,rightFill,Shader.TileMode.CLAMP)
                    alpha=if(active)255 else 185
                })
                c.drawRoundRect(RectF(x+1.4f,top+1.4f,x+segmentWidth-1.4f,bottom-1.4f),
                    radius,radius,paint(if(active)Color.argb(195,250,255,253)
                        else Color.argb(103,243,239,243),
                        if(active)2.3f else 1.1f,Paint.Style.STROKE))
                // Only exact hours inside each capsule, no second status line.
                val timeColor=if(segment.off)text else Color.rgb(18,57,47)
                write(c,segment.start+"–"+segment.end,
                    x+segmentWidth*.5f,top+(bottom-top)*.67f,
                    h*.18f,timeColor,if(active)bold else medium)
            }
        }
        c.restore()
        // The arrow is separate from the moving timeline, always in the same place.
        val arrow=Path().apply {
            moveTo(center,h*.757f)
            lineTo(center-h*.044f,h*.812f)
            lineTo(center+h*.044f,h*.812f)
            close()
        }
        c.drawPath(arrow,paint(accent))
    }
    private fun dial(c:Canvas,w:Float,h:Float,data:Schedule?,now:ZonedDateTime) {
        val side=min(w,h)
        val cx=w*.5f;val cy=h*.505f
        val radius=side*.344f;val thickness=side*.101f
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
            write(c,hour.toString(),polarX(cx,outer+side*.038f,angle),
                polarY(cy,outer+side*.038f,angle)+side*.011f,
                side*.035f,text,medium)
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
        write(c,now.format(DateTimeFormatter.ofPattern("d MMMM",Locale("uk"))),
            cx,cy-side*.152f,side*.047f,muted,medium)
        write(c,"1.1",cx,cy-side*.017f,side*.128f,text,bold)
        write(c,"ПІДЧЕРГА",cx,cy+side*.038f,side*.030f,muted,medium)
        c.drawLine(cx-side*.139f,cy+side*.081f,
            cx+side*.139f,cy+side*.081f,
            paint(Color.rgb(93,116,133),side*.0018f))
        write(c,status,cx,cy+side*.143f,side*.043f,accent,medium)
    }

    fun draw(kind:Kind,schedule:Schedule?,now:ZonedDateTime):Bitmap {
        // Bounded ARGB_8888 images stay well below the widget binder bitmap quota.
        val size=when(kind){
            Kind.BULB->340 to 340
            Kind.CAROUSEL->840 to 260
            Kind.DIAL->630 to 630
        }
        val cBitmap=Bitmap.createBitmap(size.first,size.second,Bitmap.Config.ARGB_8888)
        val canvas=Canvas(cBitmap)
        base(canvas,size.first.toFloat(),size.second.toFloat())
        when(kind){
            Kind.BULB->bulb(canvas,size.first.toFloat(),size.second.toFloat(),schedule,now)
            Kind.CAROUSEL->strip(canvas,size.first.toFloat(),size.second.toFloat(),schedule,now)
            Kind.DIAL->dial(canvas,size.first.toFloat(),size.second.toFloat(),schedule,now)
        }
        return cBitmap
    }
}
